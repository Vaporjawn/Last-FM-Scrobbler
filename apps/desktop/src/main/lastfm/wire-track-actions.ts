import electron from "electron";
import type { AccountStore, LastfmClient } from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";
import { assertTrustedSender } from "../validate-ipc-sender.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

/** The subset of `LastfmClient` this module needs — kept narrow for easy testing. */
export interface TrackActionsClient {
  love: LastfmClient["love"];
  unlove: LastfmClient["unlove"];
  addTags: LastfmClient["addTags"];
}

export interface WireTrackActionsOptions {
  /** The origin (dev) or `file:` URL (packaged) every call on this file's channels
   * must genuinely come from — see `validate-ipc-sender.ts` and
   * `resolve-expected-renderer-origin.ts`. Every handler below checks it first: these
   * calls are signed with the active account's real Last.fm session key, so they're
   * exactly the kind of higher-privilege operation Electron's security checklist
   * recommends validating the sender for. */
  readonly expectedOrigin: string;
  /** `undefined` when secure storage isn't available on this system — see
   * `main/auth/create-account-store.ts`. */
  readonly accountStore: AccountStore | undefined;
  /** Constructs a session-keyed client on demand — signed as whichever account is
   * currently active. `undefined` when this build has no Last.fm API credentials
   * configured at all (see `main/lastfm/resolve-lastfm-credentials.ts`), independent of
   * whether an account is logged in. */
  readonly createSessionClient: ((sessionKey: string) => TrackActionsClient) | undefined;
}

const NOT_CONFIGURED_MESSAGE =
  "Last.fm API credentials are not configured for this build (LASTFM_API_KEY / " +
  "LASTFM_API_SECRET, or a saved key) — see docs/modules/desktop.md.";

const NO_ACTIVE_ACCOUNT_MESSAGE =
  "No Last.fm account is active — log in from Settings first.";

/**
 * Wires the signed, per-account track-action IPC surface (love/unlove/addTags — see
 * `shared/lastfm-api.ts`) to a session-keyed `LastfmClient` for whichever account is
 * currently active. Unlike `wire-lastfm-data.ts`'s read-only endpoints, every operation
 * here requires an active, logged-in account (Last.fm signs these calls with a session
 * key) — there is no "which user" parameter for the renderer to supply, since it's
 * always "whoever's currently active."
 */
export function wireTrackActions(options: WireTrackActionsOptions): () => void {
  const { expectedOrigin, accountStore, createSessionClient } = options;

  async function withActiveClient<T>(
    run: (client: TrackActionsClient) => Promise<T>,
  ): Promise<T> {
    if (!accountStore || !createSessionClient) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    const active = await accountStore.getActiveAccount();
    if (!active) {
      throw new Error(NO_ACTIVE_ACCOUNT_MESSAGE);
    }
    return run(createSessionClient(active.sessionKey));
  }

  ipcMain.handle(
    IPC_CHANNELS.lastfmLoveTrack,
    (event, artist: unknown, track: unknown): Promise<void> => {
      assertTrustedSender(event, expectedOrigin);
      return withActiveClient((client) => client.love({ artist: String(artist), track: String(track) }));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmUnloveTrack,
    (event, artist: unknown, track: unknown): Promise<void> => {
      assertTrustedSender(event, expectedOrigin);
      return withActiveClient((client) => client.unlove({ artist: String(artist), track: String(track) }));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmAddTags,
    (event, artist: unknown, track: unknown, tags: unknown): Promise<void> => {
      assertTrustedSender(event, expectedOrigin);
      return withActiveClient((client) =>
        client.addTags({
          artist: String(artist),
          track: String(track),
          tags: Array.isArray(tags) ? tags.map(String) : [],
        }),
      );
    },
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.lastfmLoveTrack);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmUnloveTrack);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmAddTags);
  };
}

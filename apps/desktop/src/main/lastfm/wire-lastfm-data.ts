import electron from "electron";
import type { Friend, LastfmClient, RecentTrack, TopArtist } from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

/** The subset of `LastfmClient` this module needs — kept narrow for easy testing. */
export interface LastfmDataClient {
  getRecentTracks: LastfmClient["getRecentTracks"];
  getTopArtists: LastfmClient["getTopArtists"];
  getFriends: LastfmClient["getFriends"];
}

export interface WireLastfmDataOptions {
  /** `undefined` when this build has no Last.fm API credentials configured. */
  readonly client: LastfmDataClient | undefined;
}

const NOT_CONFIGURED_MESSAGE =
  "Last.fm API credentials are not configured for this build (LASTFM_API_KEY / " +
  "LASTFM_API_SECRET) — see docs/modules/desktop.md.";

/**
 * Wires the read-only Last.fm data IPC surface (see `shared/lastfm-api.ts`) to a
 * `LastfmClient`. These are all public, unsigned endpoints — no session key or active
 * account is needed, just a username (typically the active account's, chosen by the
 * renderer).
 */
export function wireLastfmData(options: WireLastfmDataOptions): () => void {
  const { client } = options;

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetRecentTracks,
    (_event, user: unknown, limit?: unknown): Promise<readonly RecentTrack[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return client.getRecentTracks({
        user: String(user),
        ...(limit !== undefined ? { limit: Number(limit) } : {}),
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetTopArtists,
    (_event, user: unknown, limit?: unknown): Promise<readonly TopArtist[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return client.getTopArtists({
        user: String(user),
        ...(limit !== undefined ? { limit: Number(limit) } : {}),
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetFriends,
    (_event, user: unknown): Promise<readonly Friend[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return client.getFriends({ user: String(user) });
    },
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetRecentTracks);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetTopArtists);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetFriends);
  };
}

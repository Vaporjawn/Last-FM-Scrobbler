import electron from "electron";
import {
  AuthFlow,
  LastfmClient,
  ListenBrainzClient,
  type AccountStore,
  type AppCredentials,
  type AppCredentialsStore,
  type AuthFlowClient,
} from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";
import { assertTrustedSender } from "../validate-ipc-sender.js";
import type { ResolvedLibrefmCredentials } from "./resolve-librefm-credentials.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

/** Libre.fm's own equivalent of Last.fm's `ws.audioscrobbler.com` API endpoint —
 * protocol-identical (see `LastfmClient`'s own docstring on `baseUrl`), so this
 * reuses `LastfmClient` directly rather than a parallel implementation. **Not
 * independently live-verified this session** beyond `auth.getToken` tolerating a
 * garbage/missing `api_key` (lax validation at that specific step) — the full signed
 * flow (`auth.getSession`, `track.scrobble`) was not confirmed end-to-end (a real
 * verification attempt hit Cloudflare rate-limiting before completing, and wasn't
 * retried further to avoid hammering a real third-party service). If Libre.fm turns
 * out to reject requests signed with an unregistered key/secret pair, the fix is
 * purely a documentation one (users need a real Libre.fm-issued key) — nothing about
 * this client's shape would need to change. */
const LIBREFM_BASE_URL = "https://libre.fm/2.0/";
/** Libre.fm's presumed equivalent of Last.fm's `www.last.fm/api/auth/` authorization
 * page, by analogy with Last.fm's own API/auth-page domain split (see
 * `LastfmClientOptions.authUrl`'s docstring) — **not independently live-verified this
 * session**, unlike the `/2.0/` API endpoint behaviors above. If this path is wrong,
 * `login()` below will open a browser to a broken page; the fix is a one-line change
 * to this constant once the real URL is confirmed. */
const LIBREFM_AUTH_URL = "https://libre.fm/api/auth/";

const LIBREFM_NOT_CONFIGURED_MESSAGE =
  "Libre.fm login is not configured this run — either no Libre.fm API key/secret has " +
  "been baked into this build or saved yet (Settings → Accounts), or secure account " +
  "storage couldn't be set up on this system.";
const LIBREFM_NO_STORAGE_MESSAGE =
  "Can't save a Libre.fm API key on this system — secure storage isn't available.";
const LISTENBRAINZ_NOT_CONFIGURED_MESSAGE =
  "ListenBrainz isn't available this run — secure account storage couldn't be set up " +
  "on this system.";

export interface WireSecondaryAuthOptions {
  /** Same trusted-sender check every handler in `wire-auth.ts` uses — see that
   * module's docstring. */
  readonly expectedOrigin: string;
  /** `undefined` when secure storage isn't available on this system — every handler
   * here reports "not configured" rather than throwing an unhandled error in that
   * case, same convention as `wire-auth.ts`. */
  readonly librefmAccountStore: AccountStore | undefined;
  /** The *write* side of Libre.fm's app credentials — only used by
   * `librefmSetCredentials`/`librefmClearCredentials` below. Reads go through
   * `resolveLibrefmCredentials` instead (see that option), which also checks
   * `LIBREFM_API_KEY`/`LIBREFM_API_SECRET` — same environment-first, then-saved-key
   * precedence Last.fm's own `resolveLastfmCredentials` uses, see that function's
   * docstring for the full reasoning. */
  readonly librefmAppCredentialsStore: AppCredentialsStore | undefined;
  /** Resolves the Libre.fm credentials `librefmIsConfigured`/`librefmCredentialsSource`/
   * `librefmLogin` should use right now — called fresh on every one of those calls
   * (not captured once at wiring time) so a newly-saved key takes effect immediately,
   * no relaunch needed (Libre.fm has no "restart to apply a baked-in key" story the
   * way Last.fm's environment-variable path does, since `main/index.ts` re-checks
   * `process.env` on every call here, not just once at startup). Real callers pass
   * `() => resolveLibrefmCredentials({ librefmAppCredentialsStore })` — see
   * `resolve-librefm-credentials.ts`. */
  readonly resolveLibrefmCredentials: () => Promise<ResolvedLibrefmCredentials | undefined>;
  readonly listenbrainzAccountStore: AccountStore | undefined;
  /** Opens the Libre.fm authorization page — real callers pass Electron's
   * `shell.openExternal`, same as `wire-auth.ts`'s `openUrl`. */
  readonly openUrl: (url: string) => void | Promise<void>;
  /** Called right after a Libre.fm login completes, with the newly active username —
   * same reasoning and same real-caller behavior (bring the app to the foreground,
   * show a native notification) as `wire-auth.ts`'s `onLoginSuccess`. Defaults to a
   * no-op. */
  readonly onLibrefmLoginSuccess?: (username: string) => void;
  /** Same reasoning as `wire-auth.ts`'s `onLoginFailed` — a native notification is the
   * one signal guaranteed to reach the user after they've been sent away to their
   * browser for Libre.fm's own "Allow Access" step. Defaults to a no-op. */
  readonly onLibrefmLoginFailed?: (message: string) => void;
  /** Constructs the `AuthFlowClient` `login` drives, from an already-resolved Libre.fm
   * key/secret pair — injectable for testing (real tests supply a fake
   * `AuthFlowClient` directly, same convention `wire-auth.test.ts` uses, without
   * needing a real `fetch`); defaults to `createLibrefmAuthFlowClient` below, which
   * real callers never need to override. */
  readonly createLibrefmAuthFlowClient?: (credentials: AppCredentials) => AuthFlowClient;
  /** Constructs the client `listenbrainzConnect` validates a candidate token against —
   * injectable for testing, same reasoning as `createLibrefmAuthFlowClient`. Defaults
   * to a real `ListenBrainzClient`. */
  readonly createListenBrainzClient?: (token: string) => Pick<ListenBrainzClient, "validateToken">;
}

/** Builds a `LastfmClient` pointed at Libre.fm instead of Last.fm, from an
 * already-resolved key/secret pair (see `resolve-librefm-credentials.ts` — this
 * function itself does no env/storage lookups, just client construction). Shared by
 * both the login flow (`createLibrefmAuthFlowClient` below — no `sessionKey` yet,
 * since login is how one gets minted) and `main/index.ts`'s scrobbling wiring (a
 * session-keyed client, once an account is connected) — `LastfmClient` satisfies both
 * `AuthFlowClient` and `ScrobblingClient` structurally, so one factory covers both
 * call sites. */
export function buildLibrefmClient(
  credentials: AppCredentials,
  options: { readonly sessionKey?: string } = {},
): LastfmClient {
  return new LastfmClient({
    apiKey: credentials.apiKey,
    apiSecret: credentials.apiSecret,
    baseUrl: LIBREFM_BASE_URL,
    authUrl: LIBREFM_AUTH_URL,
    ...(options.sessionKey !== undefined ? { sessionKey: options.sessionKey } : {}),
  });
}

/** The real default for `WireSecondaryAuthOptions.createLibrefmAuthFlowClient` — see
 * `buildLibrefmClient` above. */
export function createLibrefmAuthFlowClient(credentials: AppCredentials): AuthFlowClient {
  return buildLibrefmClient(credentials);
}

/**
 * Wires the Libre.fm and ListenBrainz account IPC surface (see
 * `shared/secondary-auth-api.ts`) — the additional-scrobbling-destination counterpart
 * to `wire-auth.ts` (Last.fm). Kept as a separate module/IPC-channel family entirely,
 * rather than parameterizing `wire-auth.ts` itself: Last.fm's own auth surface
 * supports baked-in credentials and multi-account switching that neither additional
 * service needs (see `secondary-auth-api.ts`'s docstring), and keeping this module
 * separate means the existing, already-well-tested Last.fm auth wiring needed zero
 * changes to support multi-service scrobbling.
 */
export function wireSecondaryAuth(options: WireSecondaryAuthOptions): () => void {
  const {
    expectedOrigin,
    librefmAccountStore,
    librefmAppCredentialsStore,
    resolveLibrefmCredentials,
    listenbrainzAccountStore,
    openUrl,
    onLibrefmLoginSuccess,
    onLibrefmLoginFailed,
    createLibrefmAuthFlowClient: buildLibrefmAuthFlowClient = createLibrefmAuthFlowClient,
    createListenBrainzClient = (token: string) => new ListenBrainzClient({ token }),
  } = options;

  ipcMain.handle(IPC_CHANNELS.librefmIsConfigured, async (event): Promise<boolean> => {
    assertTrustedSender(event, expectedOrigin);
    if (!librefmAccountStore) {
      return false;
    }
    return (await resolveLibrefmCredentials()) !== undefined;
  });

  ipcMain.handle(
    IPC_CHANNELS.librefmCredentialsSource,
    async (event): Promise<"environment" | "user-supplied" | "none"> => {
      assertTrustedSender(event, expectedOrigin);
      const resolved = await resolveLibrefmCredentials();
      return resolved?.source ?? "none";
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.librefmSetCredentials,
    async (event, apiKey: unknown, apiSecret: unknown): Promise<void> => {
      assertTrustedSender(event, expectedOrigin);
      if (!librefmAppCredentialsStore) {
        throw new Error(LIBREFM_NO_STORAGE_MESSAGE);
      }
      const trimmedKey = String(apiKey).trim();
      const trimmedSecret = String(apiSecret).trim();
      if (!trimmedKey || !trimmedSecret) {
        throw new Error("Both the API key and shared secret are required.");
      }
      await librefmAppCredentialsStore.set({ apiKey: trimmedKey, apiSecret: trimmedSecret });
    },
  );

  ipcMain.handle(IPC_CHANNELS.librefmClearCredentials, async (event): Promise<void> => {
    assertTrustedSender(event, expectedOrigin);
    await librefmAppCredentialsStore?.clear();
  });

  ipcMain.handle(IPC_CHANNELS.librefmLogin, async (event): Promise<{ username: string }> => {
    assertTrustedSender(event, expectedOrigin);
    const credentials = await resolveLibrefmCredentials();
    if (!librefmAccountStore || !credentials) {
      throw new Error(LIBREFM_NOT_CONFIGURED_MESSAGE);
    }
    const client = buildLibrefmAuthFlowClient(credentials);
    const authFlow = new AuthFlow({ client, openUrl });
    try {
      const session = await authFlow.authenticate();
      await librefmAccountStore.addAccount({
        username: session.username,
        sessionKey: session.sessionKey,
      });
      await librefmAccountStore.setActiveAccount(session.username);
      onLibrefmLoginSuccess?.(session.username);
      return { username: session.username };
    } catch (error) {
      onLibrefmLoginFailed?.(error instanceof Error ? error.message : String(error));
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.librefmLogout, async (event): Promise<void> => {
    assertTrustedSender(event, expectedOrigin);
    if (!librefmAccountStore) {
      return;
    }
    const active = await librefmAccountStore.getActiveAccount();
    if (active) {
      await librefmAccountStore.removeAccount(active.username);
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.librefmGetActiveAccount,
    async (event): Promise<string | undefined> => {
      assertTrustedSender(event, expectedOrigin);
      const active = await librefmAccountStore?.getActiveAccount();
      return active?.username;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.listenbrainzConnect,
    async (event, token: unknown): Promise<{ username: string }> => {
      assertTrustedSender(event, expectedOrigin);
      if (!listenbrainzAccountStore) {
        throw new Error(LISTENBRAINZ_NOT_CONFIGURED_MESSAGE);
      }
      const trimmedToken = String(token).trim();
      if (!trimmedToken) {
        throw new Error("A ListenBrainz user token is required.");
      }
      const client = createListenBrainzClient(trimmedToken);
      const validation = await client.validateToken(trimmedToken);
      if (!validation.valid || !validation.username) {
        throw new Error("That ListenBrainz token isn't valid — check it and try again.");
      }
      await listenbrainzAccountStore.addAccount({
        username: validation.username,
        sessionKey: trimmedToken,
      });
      await listenbrainzAccountStore.setActiveAccount(validation.username);
      return { username: validation.username };
    },
  );

  ipcMain.handle(IPC_CHANNELS.listenbrainzDisconnect, async (event): Promise<void> => {
    assertTrustedSender(event, expectedOrigin);
    if (!listenbrainzAccountStore) {
      return;
    }
    const active = await listenbrainzAccountStore.getActiveAccount();
    if (active) {
      await listenbrainzAccountStore.removeAccount(active.username);
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.listenbrainzGetActiveAccount,
    async (event): Promise<string | undefined> => {
      assertTrustedSender(event, expectedOrigin);
      const active = await listenbrainzAccountStore?.getActiveAccount();
      return active?.username;
    },
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.librefmIsConfigured);
    ipcMain.removeHandler(IPC_CHANNELS.librefmCredentialsSource);
    ipcMain.removeHandler(IPC_CHANNELS.librefmSetCredentials);
    ipcMain.removeHandler(IPC_CHANNELS.librefmClearCredentials);
    ipcMain.removeHandler(IPC_CHANNELS.librefmLogin);
    ipcMain.removeHandler(IPC_CHANNELS.librefmLogout);
    ipcMain.removeHandler(IPC_CHANNELS.librefmGetActiveAccount);
    ipcMain.removeHandler(IPC_CHANNELS.listenbrainzConnect);
    ipcMain.removeHandler(IPC_CHANNELS.listenbrainzDisconnect);
    ipcMain.removeHandler(IPC_CHANNELS.listenbrainzGetActiveAccount);
  };
}

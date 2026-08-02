import electron from "electron";
import {
  AuthFlow,
  type AccountStore,
  type AppCredentialsStore,
  type AuthFlowClient,
} from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

const NOT_CONFIGURED_MESSAGE =
  "Last.fm login is not configured/available this run — either this build has no API " +
  "credentials configured (LASTFM_API_KEY / LASTFM_API_SECRET), or secure account " +
  "storage couldn't be set up on this system. See docs/modules/desktop.md.";

const NO_APP_CREDENTIALS_STORAGE_MESSAGE =
  "Can't save a Last.fm API key on this system — secure storage isn't available " +
  "(see docs/modules/desktop.md).";

export interface WireAuthOptions {
  /** `undefined` when secure storage (Electron's `safeStorage`) isn't available on
   * this system — see `main/auth/create-account-store.ts`. Every handler here reports
   * "not configured" rather than throwing an unhandled error in that case. */
  readonly accountStore: AccountStore | undefined;
  /** `undefined` when this build has no Last.fm API credentials configured — see
   * `main/lastfm/resolve-lastfm-credentials.ts`. */
  readonly client: AuthFlowClient | undefined;
  /** Opens the Last.fm authorization page — real callers pass Electron's `shell.openExternal`. */
  readonly openUrl: (url: string) => void | Promise<void>;
  /** Where `client`'s credentials came from, when configured. Lets the renderer know
   * whether "change/clear your key" makes sense to offer — an "environment"-sourced
   * key was a deliberate choice by whoever built/launched this instance, not
   * something to let the end user clear from inside the app. */
  readonly credentialsSource?: "environment" | "user-supplied" | undefined;
  /** Persists a user-supplied Last.fm API key/secret pair — the "bring your own key"
   * alternative for builds with no `LASTFM_API_KEY`/`LASTFM_API_SECRET` baked in.
   * `undefined` when secure storage isn't available (same caveat as `accountStore`).
   * Saving only takes effect on the *next* launch, since `client` above is already
   * constructed by the time this is wired — callers should invoke `relaunch()`
   * afterward for it to apply this run. */
  readonly appCredentialsStore?: AppCredentialsStore | undefined;
  /** Restarts the app so a newly-saved key takes effect. Real callers pass
   * `() => { app.relaunch(); app.exit(0); }`. Defaults to a no-op. */
  readonly relaunch?: () => void;
  /** Called right after a login completes (the user approved access on Last.fm's own
   * page in their browser, and the resulting session is stored), with the newly
   * active username. Real callers use this to bring the app's window back to the
   * front and/or show a native notification — the user was just sent away to their
   * browser for the Last.fm approval step, and there's no other signal in the main
   * process for "they're done, bring them back." Defaults to a no-op. */
  readonly onLoginSuccess?: (username: string) => void;
  /** Called when a login attempt fails *after* the browser was already opened —
   * most commonly `AuthTimeoutError` (nobody clicked "Allow Access" on Last.fm within
   * the poll window) but also any other error `AuthFlow.authenticate()`/the account
   * store throws. This is deliberately separate from the renderer's own error
   * handling (`PreferencesPage`'s snackbar): that only reaches the user if the window
   * is still open and focused when the failure happens, which — since the whole point
   * of this flow is sending them away to a browser — is exactly the case that can't be
   * assumed. Real callers use this to show a native notification, the one signal
   * guaranteed to reach the user even if they've switched away entirely. Receives
   * `error.message`. Defaults to a no-op. Never fires for the "not configured" guard
   * below — that fails synchronously, before any browser is opened, so whoever clicked
   * the button is still right there to see the normal error. */
  readonly onLoginFailed?: (message: string) => void;
}

/**
 * Wires the account/auth IPC surface (see `shared/auth-api.ts`) to a real `AccountStore`
 * and `AuthFlow`. Deliberately never sends a `StoredAccount`'s `sessionKey` across IPC —
 * every handler here returns bare usernames.
 */
export function wireAuth(options: WireAuthOptions): () => void {
  const {
    accountStore,
    client,
    openUrl,
    credentialsSource,
    appCredentialsStore,
    relaunch,
    onLoginSuccess,
    onLoginFailed,
  } = options;

  ipcMain.handle(
    IPC_CHANNELS.authIsConfigured,
    (): boolean => accountStore !== undefined && client !== undefined,
  );

  ipcMain.handle(
    IPC_CHANNELS.authCredentialsSource,
    (): "environment" | "user-supplied" | "none" => {
      if (!client) {
        return "none";
      }
      return credentialsSource ?? "none";
    },
  );

  ipcMain.handle(IPC_CHANNELS.authLogin, async (): Promise<{ username: string }> => {
    if (!accountStore || !client) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    const authFlow = new AuthFlow({ client, openUrl });
    try {
      const session = await authFlow.authenticate();
      await accountStore.addAccount({ username: session.username, sessionKey: session.sessionKey });
      await accountStore.setActiveAccount(session.username);
      onLoginSuccess?.(session.username);
      return { username: session.username };
    } catch (error) {
      // Reported via onLoginFailed *in addition to* rethrowing below — the renderer's
      // own promise-rejection handling (PreferencesPage's snackbar) still runs
      // unchanged when the window is open and focused; onLoginFailed exists for the
      // case that matters here, where it isn't.
      onLoginFailed?.(error instanceof Error ? error.message : String(error));
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.authLogout, async (_event, username: unknown): Promise<void> => {
    if (!accountStore) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    await accountStore.removeAccount(String(username));
  });

  ipcMain.handle(IPC_CHANNELS.authListAccounts, async (): Promise<string[]> => {
    if (!accountStore) {
      return [];
    }
    const accounts = await accountStore.listAccounts();
    return accounts.map((account) => account.username);
  });

  ipcMain.handle(IPC_CHANNELS.authGetActiveAccount, async (): Promise<string | undefined> => {
    if (!accountStore) {
      return undefined;
    }
    const active = await accountStore.getActiveAccount();
    return active?.username;
  });

  ipcMain.handle(
    IPC_CHANNELS.authSetActiveAccount,
    async (_event, username: unknown): Promise<void> => {
      if (!accountStore) {
        throw new Error(NOT_CONFIGURED_MESSAGE);
      }
      await accountStore.setActiveAccount(String(username));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.authSetAppCredentials,
    async (_event, apiKey: unknown, apiSecret: unknown): Promise<void> => {
      if (!appCredentialsStore) {
        throw new Error(NO_APP_CREDENTIALS_STORAGE_MESSAGE);
      }
      const trimmedKey = String(apiKey).trim();
      const trimmedSecret = String(apiSecret).trim();
      if (!trimmedKey || !trimmedSecret) {
        throw new Error("Both the API key and shared secret are required.");
      }
      await appCredentialsStore.set({ apiKey: trimmedKey, apiSecret: trimmedSecret });
    },
  );

  ipcMain.handle(IPC_CHANNELS.authClearAppCredentials, async (): Promise<void> => {
    await appCredentialsStore?.clear();
  });

  ipcMain.handle(IPC_CHANNELS.appRelaunch, (): void => {
    relaunch?.();
  });

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.authIsConfigured);
    ipcMain.removeHandler(IPC_CHANNELS.authCredentialsSource);
    ipcMain.removeHandler(IPC_CHANNELS.authLogin);
    ipcMain.removeHandler(IPC_CHANNELS.authLogout);
    ipcMain.removeHandler(IPC_CHANNELS.authListAccounts);
    ipcMain.removeHandler(IPC_CHANNELS.authGetActiveAccount);
    ipcMain.removeHandler(IPC_CHANNELS.authSetActiveAccount);
    ipcMain.removeHandler(IPC_CHANNELS.authSetAppCredentials);
    ipcMain.removeHandler(IPC_CHANNELS.authClearAppCredentials);
    ipcMain.removeHandler(IPC_CHANNELS.appRelaunch);
  };
}

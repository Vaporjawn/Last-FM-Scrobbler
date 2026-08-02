import electron from "electron";
import { AuthFlow, type AccountStore, type AuthFlowClient } from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

const NOT_CONFIGURED_MESSAGE =
  "Last.fm login is not configured/available this run — either this build has no API " +
  "credentials configured (LASTFM_API_KEY / LASTFM_API_SECRET), or secure account " +
  "storage couldn't be set up on this system. See docs/modules/desktop.md.";

export interface WireAuthOptions {
  /** `undefined` when secure storage (Electron's `safeStorage`) isn't available on
   * this system — see `main/auth/create-account-store.ts`. Every handler here reports
   * "not configured" rather than throwing an unhandled error in that case. */
  readonly accountStore: AccountStore | undefined;
  /** `undefined` when this build has no Last.fm API credentials configured — see
   * `main/lastfm/create-lastfm-client.ts`. */
  readonly client: AuthFlowClient | undefined;
  /** Opens the Last.fm authorization page — real callers pass Electron's `shell.openExternal`. */
  readonly openUrl: (url: string) => void | Promise<void>;
}

/**
 * Wires the account/auth IPC surface (see `shared/auth-api.ts`) to a real `AccountStore`
 * and `AuthFlow`. Deliberately never sends a `StoredAccount`'s `sessionKey` across IPC —
 * every handler here returns bare usernames.
 */
export function wireAuth(options: WireAuthOptions): () => void {
  const { accountStore, client, openUrl } = options;

  ipcMain.handle(
    IPC_CHANNELS.authIsConfigured,
    (): boolean => accountStore !== undefined && client !== undefined,
  );

  ipcMain.handle(IPC_CHANNELS.authLogin, async (): Promise<{ username: string }> => {
    if (!accountStore || !client) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    const authFlow = new AuthFlow({ client, openUrl });
    const session = await authFlow.authenticate();
    await accountStore.addAccount({ username: session.username, sessionKey: session.sessionKey });
    await accountStore.setActiveAccount(session.username);
    return { username: session.username };
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

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.authIsConfigured);
    ipcMain.removeHandler(IPC_CHANNELS.authLogin);
    ipcMain.removeHandler(IPC_CHANNELS.authLogout);
    ipcMain.removeHandler(IPC_CHANNELS.authListAccounts);
    ipcMain.removeHandler(IPC_CHANNELS.authGetActiveAccount);
    ipcMain.removeHandler(IPC_CHANNELS.authSetActiveAccount);
  };
}

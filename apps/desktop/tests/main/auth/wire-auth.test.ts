import { describe, expect, it, vi } from "vitest";
import { AccountStore, AppCredentialsStore, type SecretStorage } from "@lastfm-scrobbler/core";

const ipcMainHandlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
const ipcMain = {
  handle: vi.fn((channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
    ipcMainHandlers.set(channel, handler);
  }),
  removeHandler: vi.fn((channel: string) => {
    ipcMainHandlers.delete(channel);
  }),
};

vi.mock("electron", () => ({ ipcMain, default: { ipcMain } }));

const { wireAuth } = await import("../../../src/main/auth/wire-auth.js");
const { IPC_CHANNELS } = await import("../../../src/shared/ipc-channels.js");

function inMemoryStorage(): SecretStorage {
  const data = new Map<string, string>();
  return {
    get: (key) => Promise.resolve(data.get(key)),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
    delete: (key) => {
      data.delete(key);
      return Promise.resolve();
    },
    list: () => Promise.resolve([...data.keys()]),
  };
}

function fakeAuthFlowClient(username: string) {
  return {
    getAuthToken: () => Promise.resolve("token123"),
    buildAuthUrl: (token: string) => `https://last.fm/auth?token=${token}`,
    getSession: () => Promise.resolve({ username, sessionKey: "sk-123", isSubscriber: false }),
  };
}

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = ipcMainHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return Promise.resolve(handler({}, ...args));
}

describe("wireAuth", () => {
  it("isConfigured reports false when no client is configured", async () => {
    wireAuth({ accountStore: new AccountStore(inMemoryStorage()), client: undefined, openUrl: vi.fn() });

    await expect(invoke(IPC_CHANNELS.authIsConfigured)).resolves.toBe(false);
  });

  it("isConfigured reports true when a client is configured", async () => {
    wireAuth({
      accountStore: new AccountStore(inMemoryStorage()),
      client: fakeAuthFlowClient("alice"),
      openUrl: vi.fn(),
    });

    await expect(invoke(IPC_CHANNELS.authIsConfigured)).resolves.toBe(true);
  });

  it("login runs the auth flow, stores the account, and makes it active", async () => {
    const accountStore = new AccountStore(inMemoryStorage());
    const openUrl = vi.fn();
    wireAuth({ accountStore, client: fakeAuthFlowClient("alice"), openUrl });

    const result = await invoke(IPC_CHANNELS.authLogin);

    expect(result).toEqual({ username: "alice" });
    expect(openUrl).toHaveBeenCalledWith("https://last.fm/auth?token=token123");
    await expect(accountStore.getActiveAccount()).resolves.toEqual({
      username: "alice",
      sessionKey: "sk-123",
    });
  });

  it("login calls onLoginSuccess with the newly active username once the session is stored", async () => {
    const accountStore = new AccountStore(inMemoryStorage());
    const onLoginSuccess = vi.fn();
    wireAuth({
      accountStore,
      client: fakeAuthFlowClient("alice"),
      openUrl: vi.fn(),
      onLoginSuccess,
    });

    await invoke(IPC_CHANNELS.authLogin);

    expect(onLoginSuccess).toHaveBeenCalledExactlyOnceWith("alice");
  });

  it("login doesn't throw when no onLoginSuccess callback was provided", async () => {
    const accountStore = new AccountStore(inMemoryStorage());
    wireAuth({ accountStore, client: fakeAuthFlowClient("alice"), openUrl: vi.fn() });

    await expect(invoke(IPC_CHANNELS.authLogin)).resolves.toEqual({ username: "alice" });
  });

  it("login calls onLoginFailed with the error message when the auth flow throws, and still rejects", async () => {
    const accountStore = new AccountStore(inMemoryStorage());
    const onLoginFailed = vi.fn();
    const failingClient = {
      getAuthToken: () => Promise.resolve("token123"),
      buildAuthUrl: (token: string) => `https://last.fm/auth?token=${token}`,
      getSession: () => Promise.reject(new Error("Timed out waiting for the user to authorize")),
    };
    wireAuth({ accountStore, client: failingClient, openUrl: vi.fn(), onLoginFailed });

    await expect(invoke(IPC_CHANNELS.authLogin)).rejects.toThrow(/timed out/i);

    expect(onLoginFailed).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/timed out/i),
    );
  });

  it("login doesn't call onLoginSuccess/onLoginFailed for the 'not configured' guard — the caller is still right there", async () => {
    const onLoginSuccess = vi.fn();
    const onLoginFailed = vi.fn();
    wireAuth({
      accountStore: new AccountStore(inMemoryStorage()),
      client: undefined,
      openUrl: vi.fn(),
      onLoginSuccess,
      onLoginFailed,
    });

    await expect(invoke(IPC_CHANNELS.authLogin)).rejects.toThrow(/not configured/i);

    expect(onLoginSuccess).not.toHaveBeenCalled();
    expect(onLoginFailed).not.toHaveBeenCalled();
  });

  it("login doesn't throw when no onLoginFailed callback was provided and the auth flow fails", async () => {
    const accountStore = new AccountStore(inMemoryStorage());
    const failingClient = {
      getAuthToken: () => Promise.resolve("token123"),
      buildAuthUrl: (token: string) => `https://last.fm/auth?token=${token}`,
      getSession: () => Promise.reject(new Error("nope")),
    };
    wireAuth({ accountStore, client: failingClient, openUrl: vi.fn() });

    await expect(invoke(IPC_CHANNELS.authLogin)).rejects.toThrow("nope");
  });

  it("login throws a clear error when the app isn't configured with API credentials", async () => {
    wireAuth({ accountStore: new AccountStore(inMemoryStorage()), client: undefined, openUrl: vi.fn() });

    await expect(invoke(IPC_CHANNELS.authLogin)).rejects.toThrow(/not configured/i);
  });

  it("gracefully reports 'not configured' across the board when accountStore is undefined (no secure storage)", async () => {
    wireAuth({ accountStore: undefined, client: fakeAuthFlowClient("alice"), openUrl: vi.fn() });

    await expect(invoke(IPC_CHANNELS.authIsConfigured)).resolves.toBe(false);
    await expect(invoke(IPC_CHANNELS.authLogin)).rejects.toThrow(/not configured/i);
    await expect(invoke(IPC_CHANNELS.authListAccounts)).resolves.toEqual([]);
    await expect(invoke(IPC_CHANNELS.authGetActiveAccount)).resolves.toBeUndefined();
    await expect(invoke(IPC_CHANNELS.authSetActiveAccount, "alice")).rejects.toThrow(/not configured/i);
  });

  it("listAccounts returns usernames only, never session keys", async () => {
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
    wireAuth({ accountStore, client: undefined, openUrl: vi.fn() });

    const result = await invoke(IPC_CHANNELS.authListAccounts);

    expect(result).toEqual(["alice"]);
  });

  it("getActiveAccount returns the active username", async () => {
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
    wireAuth({ accountStore, client: undefined, openUrl: vi.fn() });

    await expect(invoke(IPC_CHANNELS.authGetActiveAccount)).resolves.toBe("alice");
  });

  it("logout removes the account", async () => {
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
    wireAuth({ accountStore, client: undefined, openUrl: vi.fn() });

    await invoke(IPC_CHANNELS.authLogout, "alice");

    await expect(accountStore.listAccounts()).resolves.toEqual([]);
  });

  it("setActiveAccount switches the active account", async () => {
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "sk-1" });
    await accountStore.addAccount({ username: "bob", sessionKey: "sk-2" });
    wireAuth({ accountStore, client: undefined, openUrl: vi.fn() });

    await invoke(IPC_CHANNELS.authSetActiveAccount, "bob");

    await expect(accountStore.getActiveAccount()).resolves.toEqual({
      username: "bob",
      sessionKey: "sk-2",
    });
  });

  it("removes all handlers when the returned cleanup function is called", () => {
    const stop = wireAuth({
      accountStore: new AccountStore(inMemoryStorage()),
      client: undefined,
      openUrl: vi.fn(),
    });
    expect(ipcMainHandlers.has(IPC_CHANNELS.authLogin)).toBe(true);
    expect(ipcMainHandlers.has(IPC_CHANNELS.authSetAppCredentials)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.authLogin)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.authIsConfigured)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.authCredentialsSource)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.authSetAppCredentials)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.authClearAppCredentials)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.appRelaunch)).toBe(false);
  });

  describe("bring your own key (app credentials)", () => {
    it("authCredentialsSource reports 'none' when no client is configured", async () => {
      wireAuth({
        accountStore: new AccountStore(inMemoryStorage()),
        client: undefined,
        openUrl: vi.fn(),
      });

      await expect(invoke(IPC_CHANNELS.authCredentialsSource)).resolves.toBe("none");
    });

    it("authCredentialsSource reports 'none' when a client is configured but no source was given", async () => {
      wireAuth({
        accountStore: new AccountStore(inMemoryStorage()),
        client: fakeAuthFlowClient("alice"),
        openUrl: vi.fn(),
      });

      await expect(invoke(IPC_CHANNELS.authCredentialsSource)).resolves.toBe("none");
    });

    it("authCredentialsSource reports the configured source", async () => {
      wireAuth({
        accountStore: new AccountStore(inMemoryStorage()),
        client: fakeAuthFlowClient("alice"),
        openUrl: vi.fn(),
        credentialsSource: "environment",
      });

      await expect(invoke(IPC_CHANNELS.authCredentialsSource)).resolves.toBe("environment");
    });

    it("authSetAppCredentials persists a trimmed key/secret pair", async () => {
      const appCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      wireAuth({
        accountStore: new AccountStore(inMemoryStorage()),
        client: undefined,
        openUrl: vi.fn(),
        appCredentialsStore,
      });

      await invoke(IPC_CHANNELS.authSetAppCredentials, "  my-key  ", "  my-secret  ");

      await expect(appCredentialsStore.get()).resolves.toEqual({
        apiKey: "my-key",
        apiSecret: "my-secret",
      });
    });

    it("authSetAppCredentials rejects an empty key or secret, without persisting anything", async () => {
      const appCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      wireAuth({
        accountStore: new AccountStore(inMemoryStorage()),
        client: undefined,
        openUrl: vi.fn(),
        appCredentialsStore,
      });

      await expect(invoke(IPC_CHANNELS.authSetAppCredentials, "   ", "my-secret")).rejects.toThrow(
        /required/i,
      );
      await expect(invoke(IPC_CHANNELS.authSetAppCredentials, "my-key", "")).rejects.toThrow(
        /required/i,
      );
      await expect(appCredentialsStore.get()).resolves.toBeUndefined();
    });

    it("authSetAppCredentials throws a clear error when secure storage isn't available", async () => {
      wireAuth({
        accountStore: new AccountStore(inMemoryStorage()),
        client: undefined,
        openUrl: vi.fn(),
        appCredentialsStore: undefined,
      });

      await expect(
        invoke(IPC_CHANNELS.authSetAppCredentials, "my-key", "my-secret"),
      ).rejects.toThrow(/secure storage/i);
    });

    it("authClearAppCredentials removes a previously saved key", async () => {
      const appCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      await appCredentialsStore.set({ apiKey: "my-key", apiSecret: "my-secret" });
      wireAuth({
        accountStore: new AccountStore(inMemoryStorage()),
        client: undefined,
        openUrl: vi.fn(),
        appCredentialsStore,
      });

      await invoke(IPC_CHANNELS.authClearAppCredentials);

      await expect(appCredentialsStore.get()).resolves.toBeUndefined();
    });

    it("authClearAppCredentials is a graceful no-op when there's no store", async () => {
      wireAuth({
        accountStore: new AccountStore(inMemoryStorage()),
        client: undefined,
        openUrl: vi.fn(),
        appCredentialsStore: undefined,
      });

      await expect(invoke(IPC_CHANNELS.authClearAppCredentials)).resolves.toBeUndefined();
    });

    it("appRelaunch invokes the injected relaunch callback", async () => {
      const relaunch = vi.fn();
      wireAuth({
        accountStore: new AccountStore(inMemoryStorage()),
        client: undefined,
        openUrl: vi.fn(),
        relaunch,
      });

      await invoke(IPC_CHANNELS.appRelaunch);

      expect(relaunch).toHaveBeenCalledOnce();
    });

    it("appRelaunch doesn't throw when no relaunch callback was provided", async () => {
      wireAuth({
        accountStore: new AccountStore(inMemoryStorage()),
        client: undefined,
        openUrl: vi.fn(),
      });

      await expect(invoke(IPC_CHANNELS.appRelaunch)).resolves.toBeUndefined();
    });
  });
});

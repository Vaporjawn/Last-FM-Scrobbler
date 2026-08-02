import { describe, expect, it, vi } from "vitest";
import { AccountStore, type SecretStorage } from "@lastfm-scrobbler/core";

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

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.authLogin)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.authIsConfigured)).toBe(false);
  });
});

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

const { wireTrackActions } = await import("../../../src/main/lastfm/wire-track-actions.js");
const { IPC_CHANNELS } = await import("../../../src/shared/ipc-channels.js");

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = ipcMainHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return Promise.resolve(handler({}, ...args));
}

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

async function accountStoreWithActiveAccount(username: string, sessionKey: string) {
  const store = new AccountStore(inMemoryStorage());
  await store.addAccount({ username, sessionKey });
  await store.setActiveAccount(username);
  return store;
}

function fakeSessionClient() {
  return {
    love: vi.fn().mockResolvedValue(undefined),
    unlove: vi.fn().mockResolvedValue(undefined),
    addTags: vi.fn().mockResolvedValue(undefined),
  };
}

describe("wireTrackActions", () => {
  it("love() signs the request with the active account's session key", async () => {
    const accountStore = await accountStoreWithActiveAccount("alice", "sk-123");
    const client = fakeSessionClient();
    const createSessionClient = vi.fn().mockReturnValue(client);
    wireTrackActions({ accountStore, createSessionClient });

    await invoke(IPC_CHANNELS.lastfmLoveTrack, "Aphex Twin", "Windowlicker");

    expect(createSessionClient).toHaveBeenCalledWith("sk-123");
    expect(client.love).toHaveBeenCalledWith({ artist: "Aphex Twin", track: "Windowlicker" });
  });

  it("unlove() signs the request with the active account's session key", async () => {
    const accountStore = await accountStoreWithActiveAccount("alice", "sk-123");
    const client = fakeSessionClient();
    wireTrackActions({ accountStore, createSessionClient: () => client });

    await invoke(IPC_CHANNELS.lastfmUnloveTrack, "Aphex Twin", "Windowlicker");

    expect(client.unlove).toHaveBeenCalledWith({ artist: "Aphex Twin", track: "Windowlicker" });
  });

  it("addTags() forwards the tag list", async () => {
    const accountStore = await accountStoreWithActiveAccount("alice", "sk-123");
    const client = fakeSessionClient();
    wireTrackActions({ accountStore, createSessionClient: () => client });

    await invoke(IPC_CHANNELS.lastfmAddTags, "Aphex Twin", "Windowlicker", ["idm", "electronic"]);

    expect(client.addTags).toHaveBeenCalledWith({
      artist: "Aphex Twin",
      track: "Windowlicker",
      tags: ["idm", "electronic"],
    });
  });

  it("rejects with a clear message when no account is active", async () => {
    const accountStore = new AccountStore(inMemoryStorage());
    wireTrackActions({ accountStore, createSessionClient: vi.fn() });

    await expect(invoke(IPC_CHANNELS.lastfmLoveTrack, "A", "T")).rejects.toThrow(/no.*account.*active/i);
  });

  it("rejects with a clear message when accountStore is undefined (no secure storage)", async () => {
    wireTrackActions({ accountStore: undefined, createSessionClient: vi.fn() });

    await expect(invoke(IPC_CHANNELS.lastfmLoveTrack, "A", "T")).rejects.toThrow(/not configured/i);
  });

  it("rejects with a clear message when createSessionClient is undefined (no API credentials)", async () => {
    const accountStore = await accountStoreWithActiveAccount("alice", "sk-123");
    wireTrackActions({ accountStore, createSessionClient: undefined });

    await expect(invoke(IPC_CHANNELS.lastfmLoveTrack, "A", "T")).rejects.toThrow(/not configured/i);
  });

  it("removes all handlers when the returned cleanup function is called", async () => {
    const accountStore = await accountStoreWithActiveAccount("alice", "sk-123");
    const stop = wireTrackActions({ accountStore, createSessionClient: () => fakeSessionClient() });
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmLoveTrack)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmLoveTrack)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmUnloveTrack)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmAddTags)).toBe(false);
  });
});

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

/** Matches this test file's default fake `senderFrame` below — every
 * `wireTrackActions(...)` call site here passes this so existing tests keep
 * exercising a *trusted* sender by default; the "untrusted sender" describe block
 * below is what actually varies it. */
const EXPECTED_ORIGIN = "http://localhost:5173";
const TRUSTED_EVENT = { senderFrame: { url: "http://localhost:5173/" } };

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  return invokeFrom(TRUSTED_EVENT, channel, ...args);
}

/** Like `invoke()`, but with an explicit (possibly untrusted, possibly `null`
 * `senderFrame`) event — for the "untrusted sender" tests below. */
// `async` is load-bearing, not stylistic: `assertTrustedSender` throws *synchronously*
// inside these handlers (they aren't all `async` themselves), so a non-async wrapper
// here would let that throw escape as a real exception instead of becoming a promise
// rejection `expect(...).rejects.toThrow()` can actually catch.
async function invokeFrom(event: unknown, channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = ipcMainHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return await handler(event, ...args);
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
    wireTrackActions({ expectedOrigin: EXPECTED_ORIGIN, accountStore, createSessionClient });

    await invoke(IPC_CHANNELS.lastfmLoveTrack, "Aphex Twin", "Windowlicker");

    expect(createSessionClient).toHaveBeenCalledWith("sk-123");
    expect(client.love).toHaveBeenCalledWith({ artist: "Aphex Twin", track: "Windowlicker" });
  });

  it("unlove() signs the request with the active account's session key", async () => {
    const accountStore = await accountStoreWithActiveAccount("alice", "sk-123");
    const client = fakeSessionClient();
    wireTrackActions({ expectedOrigin: EXPECTED_ORIGIN, accountStore, createSessionClient: () => client });

    await invoke(IPC_CHANNELS.lastfmUnloveTrack, "Aphex Twin", "Windowlicker");

    expect(client.unlove).toHaveBeenCalledWith({ artist: "Aphex Twin", track: "Windowlicker" });
  });

  it("addTags() forwards the tag list", async () => {
    const accountStore = await accountStoreWithActiveAccount("alice", "sk-123");
    const client = fakeSessionClient();
    wireTrackActions({ expectedOrigin: EXPECTED_ORIGIN, accountStore, createSessionClient: () => client });

    await invoke(IPC_CHANNELS.lastfmAddTags, "Aphex Twin", "Windowlicker", ["idm", "electronic"]);

    expect(client.addTags).toHaveBeenCalledWith({
      artist: "Aphex Twin",
      track: "Windowlicker",
      tags: ["idm", "electronic"],
    });
  });

  it("rejects with a clear message when no account is active", async () => {
    const accountStore = new AccountStore(inMemoryStorage());
    wireTrackActions({ expectedOrigin: EXPECTED_ORIGIN, accountStore, createSessionClient: vi.fn() });

    await expect(invoke(IPC_CHANNELS.lastfmLoveTrack, "A", "T")).rejects.toThrow(/no.*account.*active/i);
  });

  it("rejects with a clear message when accountStore is undefined (no secure storage)", async () => {
    wireTrackActions({ expectedOrigin: EXPECTED_ORIGIN, accountStore: undefined, createSessionClient: vi.fn() });

    await expect(invoke(IPC_CHANNELS.lastfmLoveTrack, "A", "T")).rejects.toThrow(/not configured/i);
  });

  it("rejects with a clear message when createSessionClient is undefined (no API credentials)", async () => {
    const accountStore = await accountStoreWithActiveAccount("alice", "sk-123");
    wireTrackActions({ expectedOrigin: EXPECTED_ORIGIN, accountStore, createSessionClient: undefined });

    await expect(invoke(IPC_CHANNELS.lastfmLoveTrack, "A", "T")).rejects.toThrow(/not configured/i);
  });

  it("removes all handlers when the returned cleanup function is called", async () => {
    const accountStore = await accountStoreWithActiveAccount("alice", "sk-123");
    const stop = wireTrackActions({ expectedOrigin: EXPECTED_ORIGIN, accountStore, createSessionClient: () => fakeSessionClient() });
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmLoveTrack)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmLoveTrack)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmUnloveTrack)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmAddTags)).toBe(false);
  });

  describe("untrusted sender", () => {
    async function wireWithTrustedClient() {
      const accountStore = await accountStoreWithActiveAccount("alice", "sk-123");
      const client = fakeSessionClient();
      wireTrackActions({ expectedOrigin: EXPECTED_ORIGIN, accountStore, createSessionClient: () => client });
      return client;
    }

    it("rejects love() from a senderFrame whose origin doesn't match", async () => {
      const client = await wireWithTrustedClient();

      await expect(
        invokeFrom(
          { senderFrame: { url: "http://evil.example/" } },
          IPC_CHANNELS.lastfmLoveTrack,
          "Aphex Twin",
          "Windowlicker",
        ),
      ).rejects.toThrow(/untrusted sender/i);
      expect(client.love).not.toHaveBeenCalled();
    });

    it("rejects unlove() when senderFrame is null", async () => {
      const client = await wireWithTrustedClient();

      await expect(
        invokeFrom({ senderFrame: null }, IPC_CHANNELS.lastfmUnloveTrack, "Aphex Twin", "Windowlicker"),
      ).rejects.toThrow(/no senderFrame/i);
      expect(client.unlove).not.toHaveBeenCalled();
    });

    it("rejects addTags() from an untrusted sender", async () => {
      const client = await wireWithTrustedClient();

      await expect(
        invokeFrom(
          { senderFrame: { url: "file:///tmp/evil.html" } },
          IPC_CHANNELS.lastfmAddTags,
          "Aphex Twin",
          "Windowlicker",
          ["idm"],
        ),
      ).rejects.toThrow(/untrusted sender/i);
      expect(client.addTags).not.toHaveBeenCalled();
    });
  });
});

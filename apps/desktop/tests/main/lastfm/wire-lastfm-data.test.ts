import { describe, expect, it, vi } from "vitest";

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

const { wireLastfmData } = await import("../../../src/main/lastfm/wire-lastfm-data.js");
const { IPC_CHANNELS } = await import("../../../src/shared/ipc-channels.js");

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = ipcMainHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return Promise.resolve(handler({}, ...args));
}

function fakeClient() {
  return {
    getRecentTracks: vi.fn().mockResolvedValue([{ artist: "A", track: "T", nowPlaying: false }]),
    getTopArtists: vi.fn().mockResolvedValue([{ name: "A", playCount: 5 }]),
    getFriends: vi.fn().mockResolvedValue([{ username: "bob" }]),
  };
}

describe("wireLastfmData", () => {
  it("getRecentTracks forwards user/limit and returns the client's result", async () => {
    const client = fakeClient();
    wireLastfmData({ client });

    const result = await invoke(IPC_CHANNELS.lastfmGetRecentTracks, "alice", 10);

    expect(client.getRecentTracks).toHaveBeenCalledWith({ user: "alice", limit: 10 });
    expect(result).toEqual([{ artist: "A", track: "T", nowPlaying: false }]);
  });

  it("getTopArtists forwards user/limit and returns the client's result", async () => {
    const client = fakeClient();
    wireLastfmData({ client });

    const result = await invoke(IPC_CHANNELS.lastfmGetTopArtists, "alice", 5);

    expect(client.getTopArtists).toHaveBeenCalledWith({ user: "alice", limit: 5 });
    expect(result).toEqual([{ name: "A", playCount: 5 }]);
  });

  it("getFriends forwards user and returns the client's result", async () => {
    const client = fakeClient();
    wireLastfmData({ client });

    const result = await invoke(IPC_CHANNELS.lastfmGetFriends, "alice");

    expect(client.getFriends).toHaveBeenCalledWith({ user: "alice" });
    expect(result).toEqual([{ username: "bob" }]);
  });

  it("all three handlers reject when no client is configured", async () => {
    wireLastfmData({ client: undefined });

    await expect(invoke(IPC_CHANNELS.lastfmGetRecentTracks, "alice")).rejects.toThrow(/not configured/i);
    await expect(invoke(IPC_CHANNELS.lastfmGetTopArtists, "alice")).rejects.toThrow(/not configured/i);
    await expect(invoke(IPC_CHANNELS.lastfmGetFriends, "alice")).rejects.toThrow(/not configured/i);
  });

  it("removes all handlers when the returned cleanup function is called", () => {
    const stop = wireLastfmData({ client: fakeClient() });
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmGetRecentTracks)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmGetRecentTracks)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmGetTopArtists)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmGetFriends)).toBe(false);
  });
});

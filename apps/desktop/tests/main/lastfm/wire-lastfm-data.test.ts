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
    getRecentTracks: vi
      .fn()
      .mockResolvedValue([{ artist: "A", track: "T", nowPlaying: false, loved: false }]),
    getTopArtists: vi.fn().mockResolvedValue([{ name: "A", playCount: 5 }]),
    getFriends: vi.fn().mockResolvedValue([{ username: "bob" }]),
    getUserInfo: vi.fn().mockResolvedValue({ username: "alice", avatarUrl: "https://example.com/a.png" }),
    getArtistInfo: vi.fn().mockResolvedValue({ name: "A", listeners: 100, playCount: 500 }),
    getSimilarArtists: vi.fn().mockResolvedValue([{ name: "B", match: 0.9 }]),
  };
}

describe("wireLastfmData", () => {
  it("getRecentTracks forwards user/limit and returns the client's result", async () => {
    const client = fakeClient();
    wireLastfmData({ client });

    const result = await invoke(IPC_CHANNELS.lastfmGetRecentTracks, "alice", 10);

    expect(client.getRecentTracks).toHaveBeenCalledWith({ user: "alice", limit: 10 });
    expect(result).toEqual([{ artist: "A", track: "T", nowPlaying: false, loved: false }]);
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

  it("getUserInfo forwards the username and returns the client's result", async () => {
    const client = fakeClient();
    wireLastfmData({ client });

    const result = await invoke(IPC_CHANNELS.lastfmGetUserInfo, "alice");

    expect(client.getUserInfo).toHaveBeenCalledWith({ user: "alice" });
    expect(result).toEqual({ username: "alice", avatarUrl: "https://example.com/a.png" });
  });

  it("getArtistInfo forwards the artist name and returns the client's result", async () => {
    const client = fakeClient();
    wireLastfmData({ client });

    const result = await invoke(IPC_CHANNELS.lastfmGetArtistInfo, "Aphex Twin");

    expect(client.getArtistInfo).toHaveBeenCalledWith({ artist: "Aphex Twin" });
    expect(result).toEqual({ name: "A", listeners: 100, playCount: 500 });
  });

  it("getSimilarArtists forwards artist/limit and returns the client's result", async () => {
    const client = fakeClient();
    wireLastfmData({ client });

    const result = await invoke(IPC_CHANNELS.lastfmGetSimilarArtists, "Aphex Twin", 4);

    expect(client.getSimilarArtists).toHaveBeenCalledWith({ artist: "Aphex Twin", limit: 4 });
    expect(result).toEqual([{ name: "B", match: 0.9 }]);
  });

  it("all handlers reject when no client is configured", async () => {
    wireLastfmData({ client: undefined });

    await expect(invoke(IPC_CHANNELS.lastfmGetRecentTracks, "alice")).rejects.toThrow(/not configured/i);
    await expect(invoke(IPC_CHANNELS.lastfmGetTopArtists, "alice")).rejects.toThrow(/not configured/i);
    await expect(invoke(IPC_CHANNELS.lastfmGetFriends, "alice")).rejects.toThrow(/not configured/i);
    await expect(invoke(IPC_CHANNELS.lastfmGetUserInfo, "alice")).rejects.toThrow(/not configured/i);
    await expect(invoke(IPC_CHANNELS.lastfmGetArtistInfo, "A")).rejects.toThrow(/not configured/i);
    await expect(invoke(IPC_CHANNELS.lastfmGetSimilarArtists, "A")).rejects.toThrow(/not configured/i);
  });

  it("removes all handlers when the returned cleanup function is called", () => {
    const stop = wireLastfmData({ client: fakeClient() });
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmGetRecentTracks)).toBe(true);
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmGetArtistInfo)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmGetRecentTracks)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmGetTopArtists)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmGetFriends)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmGetUserInfo)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmGetArtistInfo)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.lastfmGetSimilarArtists)).toBe(false);
  });
});

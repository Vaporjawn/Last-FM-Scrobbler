import type { RecentTrack } from "@lastfm-scrobbler/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LastfmDataApi } from "../../src/shared/lastfm-api.js";
import { useFriendsActivity } from "../../src/renderer/src/hooks/use-friends-activity.js";

// This codebase otherwise deliberately has no dedicated hook test files (every other
// hook is exercised indirectly through the page/component that consumes it — see
// FriendsPage.test.tsx). useFriendsActivity gets its own file because its concurrency
// limiting and per-item-independent-settle behavior is genuinely hook-internal state
// machinery that's hard to drive precisely (exact control over how many requests are
// simultaneously in flight, and over settle ordering) through a rendered page alone.

function track(name: string): RecentTrack {
  return { artist: "Artist", track: name, nowPlaying: false, loved: false };
}

function installFakeLastfmApi(getRecentTracks: LastfmDataApi["getRecentTracks"]): void {
  const api: LastfmDataApi = {
    getRecentTracks,
    getTopArtists: vi.fn().mockResolvedValue([]),
    getTopTracks: vi.fn().mockResolvedValue([]),
    getTopAlbums: vi.fn().mockResolvedValue([]),
    getFriends: vi.fn().mockResolvedValue([]),
    getUserInfo: vi.fn().mockResolvedValue({ username: "someuser" }),
    getLovedTracksCount: vi.fn().mockResolvedValue(0),
    getArtistInfo: vi.fn(),
    getSimilarArtists: vi.fn(),
    getTopTags: vi.fn(),
    getTrackInfo: vi.fn(),
    loveTrack: vi.fn(),
    unloveTrack: vi.fn(),
    addTags: vi.fn(),
  };
  Object.defineProperty(window, "lastfm", { value: api, configurable: true });
}

/** A promise plus its own externally-callable resolve/reject — for tests that need to
 * control exactly when a fetch settles relative to other actions (e.g. a friend-list
 * change firing mid-fetch). */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("useFriendsActivity", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "lastfm");
  });

  it("starts every friend at loading with no track", () => {
    installFakeLastfmApi(vi.fn().mockReturnValue(new Promise(() => undefined)));

    const { result } = renderHook(() => useFriendsActivity(["bob", "carol"]));

    expect(result.current.activityByUsername).toEqual({
      bob: { track: undefined, loading: true, error: undefined },
      carol: { track: undefined, loading: true, error: undefined },
    });
  });

  it("never has more than 8 getRecentTracks calls in flight at once", async () => {
    const usernames = Array.from({ length: 50 }, (_, index) => `friend${index}`);
    let inFlight = 0;
    let maxInFlight = 0;
    const getRecentTracks = vi.fn().mockImplementation(async (username: string) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(2);
      inFlight--;
      return [track(username)];
    });
    installFakeLastfmApi(getRecentTracks);

    renderHook(() => useFriendsActivity(usernames));

    await waitFor(() => {
      expect(getRecentTracks).toHaveBeenCalledTimes(usernames.length);
    });
    expect(maxInFlight).toBeLessThanOrEqual(8);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("updates each friend independently as their own request settles, not via Promise.all", async () => {
    const fast = deferred<readonly RecentTrack[]>();
    const slow = deferred<readonly RecentTrack[]>();
    const getRecentTracks = vi.fn().mockImplementation((username: string) => {
      return username === "bob" ? fast.promise : slow.promise;
    });
    installFakeLastfmApi(getRecentTracks);

    const { result } = renderHook(() => useFriendsActivity(["bob", "carol"]));

    await act(async () => {
      fast.resolve([track("Bob's Song")]);
      await fast.promise;
    });

    expect(result.current.activityByUsername.bob).toEqual({
      track: track("Bob's Song"),
      loading: false,
      error: undefined,
    });
    // carol's request hasn't settled yet — must not be held back by bob's.
    expect(result.current.activityByUsername.carol).toEqual({
      track: undefined,
      loading: true,
      error: undefined,
    });

    await act(async () => {
      slow.resolve([track("Carol's Song")]);
      await slow.promise;
    });

    expect(result.current.activityByUsername.carol).toEqual({
      track: track("Carol's Song"),
      loading: false,
      error: undefined,
    });
  });

  it("keeps a failed friend's fetch from blocking or blanking the others", async () => {
    const getRecentTracks = vi.fn().mockImplementation((username: string) => {
      return username === "bob"
        ? Promise.reject(new Error("network error"))
        : Promise.resolve([track("Carol's Song")]);
    });
    installFakeLastfmApi(getRecentTracks);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { result } = renderHook(() => useFriendsActivity(["bob", "carol"]));

    await waitFor(() => {
      expect(result.current.activityByUsername.bob?.loading).toBe(false);
      expect(result.current.activityByUsername.carol?.loading).toBe(false);
    });

    expect(result.current.activityByUsername.bob).toEqual({
      track: undefined,
      loading: false,
      error: "network error",
    });
    expect(result.current.activityByUsername.carol).toEqual({
      track: track("Carol's Song"),
      loading: false,
      error: undefined,
    });
    warn.mockRestore();
  });

  it("does not apply a stale in-flight fetch's result after the friend list changes", async () => {
    const stale = deferred<readonly RecentTrack[]>();
    const getRecentTracks = vi.fn().mockImplementation((username: string) => {
      return username === "bob" ? stale.promise : Promise.resolve([track("Dave's Song")]);
    });
    installFakeLastfmApi(getRecentTracks);

    const { result, rerender } = renderHook(({ usernames }) => useFriendsActivity(usernames), {
      initialProps: { usernames: ["bob"] },
    });

    rerender({ usernames: ["dave"] });

    await waitFor(() => {
      expect(result.current.activityByUsername.dave?.loading).toBe(false);
    });

    await act(async () => {
      stale.resolve([track("Bob's Song")]);
      await stale.promise;
    });

    expect(result.current.activityByUsername.bob).toBeUndefined();
    expect(result.current.activityByUsername.dave).toEqual({
      track: track("Dave's Song"),
      loading: false,
      error: undefined,
    });
  });

  it("re-fetches every friend from scratch when refetch() is called", async () => {
    const getRecentTracks = vi
      .fn()
      .mockResolvedValueOnce([track("Old Song")])
      .mockResolvedValueOnce([track("New Song")]);
    installFakeLastfmApi(getRecentTracks);

    const { result } = renderHook(() => useFriendsActivity(["bob"]));

    await waitFor(() => {
      expect(result.current.activityByUsername.bob).toEqual({
        track: track("Old Song"),
        loading: false,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    expect(result.current.activityByUsername.bob).toEqual({
      track: undefined,
      loading: true,
      error: undefined,
    });

    await waitFor(() => {
      expect(result.current.activityByUsername.bob).toEqual({
        track: track("New Song"),
        loading: false,
        error: undefined,
      });
    });
    expect(getRecentTracks).toHaveBeenCalledTimes(2);
  });
});

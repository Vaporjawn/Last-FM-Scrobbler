import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecentTrack } from "@lastfm-scrobbler/core";
import type { LastfmDataApi } from "../../src/shared/lastfm-api.js";
import { useRecentTracks } from "../../src/renderer/src/hooks/use-recent-tracks.js";

// This codebase otherwise deliberately has no dedicated hook test files (every other
// hook is exercised indirectly through the page/component that consumes it — see
// e.g. NowPlayingPage.test.tsx for useTrackDetail). useRecentTracks gets its own file
// because its page-accumulation/loadMore/stale-response behavior is genuinely hook-
// internal state machinery that ScrobblesPage.test.tsx can observe the *effects* of
// but can't easily drive through every edge case (racing a loadMore against a
// username change, in particular) via rendered DOM alone.

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
 * control exactly when a fetch settles relative to other actions (e.g. a username
 * change firing mid-`loadMore`). */
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

describe("useRecentTracks", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "lastfm");
  });

  it("returns the empty, inert state when username is undefined", () => {
    installFakeLastfmApi(vi.fn());

    const { result } = renderHook(() => useRecentTracks(undefined));

    expect(result.current.tracks).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.hasMore).toBe(false);
  });

  it("fetches page 1 on mount and reflects loading while it's in flight", async () => {
    const getRecentTracks = vi.fn().mockResolvedValue([track("A")]);
    installFakeLastfmApi(getRecentTracks);

    const { result } = renderHook(() => useRecentTracks("alice", 20));

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.tracks).toEqual([track("A")]);
    expect(getRecentTracks).toHaveBeenCalledWith("alice", 20, 1);
  });

  it("sets hasMore true when page 1 comes back full, false when it comes back short", async () => {
    const full = vi.fn().mockResolvedValue(Array.from({ length: 20 }, (_, i) => track(`T${i}`)));
    installFakeLastfmApi(full);
    const { result: fullResult } = renderHook(() => useRecentTracks("alice", 20));
    await waitFor(() => {
      expect(fullResult.current.loading).toBe(false);
    });
    expect(fullResult.current.hasMore).toBe(true);

    const short = vi.fn().mockResolvedValue([track("A"), track("B")]);
    installFakeLastfmApi(short);
    const { result: shortResult } = renderHook(() => useRecentTracks("bob", 20));
    await waitFor(() => {
      expect(shortResult.current.loading).toBe(false);
    });
    expect(shortResult.current.hasMore).toBe(false);
  });

  it("loadMore appends page 2 onto the existing tracks and requests the right page", async () => {
    const getRecentTracks = vi
      .fn()
      .mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => track(`P1-${i}`)))
      .mockResolvedValueOnce([track("P2-0")]);
    installFakeLastfmApi(getRecentTracks);

    const { result } = renderHook(() => useRecentTracks("alice", 20));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.tracks).toHaveLength(20);

    act(() => {
      result.current.loadMore();
    });
    expect(result.current.loadingMore).toBe(true);

    await waitFor(() => {
      expect(result.current.loadingMore).toBe(false);
    });
    expect(result.current.tracks).toHaveLength(21);
    expect(result.current.tracks[20]).toEqual(track("P2-0"));
    expect(getRecentTracks).toHaveBeenLastCalledWith("alice", 20, 2);
    // Page 2 came back short (1 < 20), so there's nothing left to load.
    expect(result.current.hasMore).toBe(false);
  });

  it("loadMore is a no-op once hasMore is false", async () => {
    const getRecentTracks = vi.fn().mockResolvedValue([track("A")]);
    installFakeLastfmApi(getRecentTracks);

    const { result } = renderHook(() => useRecentTracks("alice", 20));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.hasMore).toBe(false);

    act(() => {
      result.current.loadMore();
    });

    expect(getRecentTracks).toHaveBeenCalledTimes(1);
    expect(result.current.loadingMore).toBe(false);
  });

  it("loadMore is a no-op while a fetch is already in flight", async () => {
    const page1 = deferred<readonly RecentTrack[]>();
    const getRecentTracks = vi.fn().mockReturnValueOnce(page1.promise);
    installFakeLastfmApi(getRecentTracks);

    const { result } = renderHook(() => useRecentTracks("alice", 20));
    expect(result.current.loading).toBe(true);
    // The actual `getRecentTracks` call is deferred behind a microtask (see
    // useRecentTracks' `Promise.resolve().then(...)` — same reasoning as
    // useLastfmFetch's own docstring), so it may not have fired synchronously yet.
    await waitFor(() => {
      expect(getRecentTracks).toHaveBeenCalledTimes(1);
    });

    // Calling loadMore while the *initial* fetch is still in flight shouldn't issue a
    // second call — there's nothing to append to yet, and hasMore is still false.
    act(() => {
      result.current.loadMore();
    });
    expect(getRecentTracks).toHaveBeenCalledTimes(1);

    await act(async () => {
      page1.resolve(Array.from({ length: 20 }, (_, i) => track(`T${i}`)));
      await page1.promise;
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("keeps existing tracks and lets the user retry after a failed loadMore", async () => {
    const getRecentTracks = vi
      .fn()
      .mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => track(`T${i}`)))
      .mockRejectedValueOnce(new Error("network error"));
    installFakeLastfmApi(getRecentTracks);

    const { result } = renderHook(() => useRecentTracks("alice", 20));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => {
      expect(result.current.loadingMore).toBe(false);
    });

    expect(result.current.error).toBe("network error");
    expect(result.current.tracks).toHaveLength(20);
    // hasMore is left as it was (true) rather than being forced false by the
    // failure, so the same "Load more" control can be clicked again to retry.
    expect(result.current.hasMore).toBe(true);
  });

  it("shows an error and empties tracks when the initial fetch itself fails", async () => {
    installFakeLastfmApi(vi.fn().mockRejectedValue(new Error("network error")));

    const { result } = renderHook(() => useRecentTracks("alice", 20));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("network error");
    expect(result.current.tracks).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it("resets to a fresh page 1 when username changes, discarding accumulated pages", async () => {
    const getRecentTracks = vi
      .fn()
      .mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => track(`ALICE-${i}`)))
      .mockResolvedValueOnce([track("BOB-0")]);
    installFakeLastfmApi(getRecentTracks);

    const { result, rerender } = renderHook(({ username }) => useRecentTracks(username, 20), {
      initialProps: { username: "alice" },
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.tracks).toHaveLength(20);

    rerender({ username: "bob" });
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.tracks).toEqual([track("BOB-0")]);
    expect(getRecentTracks).toHaveBeenLastCalledWith("bob", 20, 1);
  });

  it("drops a loadMore response that resolves after username has already changed", async () => {
    const alicePage1 = Array.from({ length: 20 }, (_, i) => track(`ALICE-${i}`));
    const staleAlicePage2 = deferred<readonly RecentTrack[]>();
    const getRecentTracks = vi
      .fn()
      .mockResolvedValueOnce(alicePage1)
      .mockReturnValueOnce(staleAlicePage2.promise)
      .mockResolvedValueOnce([track("BOB-0")]);
    installFakeLastfmApi(getRecentTracks);

    const { result, rerender } = renderHook(({ username }) => useRecentTracks(username, 20), {
      initialProps: { username: "alice" },
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.loadMore();
    });
    expect(result.current.loadingMore).toBe(true);

    // Switch users while alice's loadMore is still in flight, then let it resolve —
    // its result belongs to a generation that no longer matches and must be dropped,
    // not appended onto (or its loadingMore=false clobbering) bob's fresh state.
    rerender({ username: "bob" });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.tracks).toEqual([track("BOB-0")]);

    await act(async () => {
      staleAlicePage2.resolve([track("ALICE-STALE")]);
      await staleAlicePage2.promise;
    });

    expect(result.current.tracks).toEqual([track("BOB-0")]);
  });

  describe("refetch", () => {
    it("re-fetches page 1 and replaces tracks, discarding any accumulated pages", async () => {
      const getRecentTracks = vi
        .fn()
        .mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => track(`P1-${i}`)))
        .mockResolvedValueOnce([track("P2-0")])
        // A full page again, so hasMore is true afterward and loadMore fires below.
        .mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => track(`FRESH-${i}`)))
        .mockResolvedValueOnce([track("FRESH-PAGE2")]);
      installFakeLastfmApi(getRecentTracks);

      const { result } = renderHook(() => useRecentTracks("alice", 20));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      act(() => {
        result.current.loadMore();
      });
      await waitFor(() => {
        expect(result.current.loadingMore).toBe(false);
      });
      expect(result.current.tracks).toHaveLength(21);

      act(() => {
        result.current.refetch();
      });
      expect(result.current.refreshing).toBe(true);
      // Existing (stale) tracks stay on screen while refreshing — no blank flash.
      expect(result.current.tracks).toHaveLength(21);

      await waitFor(() => {
        expect(result.current.refreshing).toBe(false);
      });
      expect(result.current.tracks).toHaveLength(20);
      expect(result.current.tracks[0]).toEqual(track("FRESH-0"));
      expect(getRecentTracks).toHaveBeenLastCalledWith("alice", 20, 1);

      // loadMore works again after a refetch — proves pageRef was actually reset to 1,
      // not left at whatever page loadMore had advanced it to before the refetch.
      act(() => {
        result.current.loadMore();
      });
      await waitFor(() => {
        expect(result.current.loadingMore).toBe(false);
      });
      expect(getRecentTracks).toHaveBeenLastCalledWith("alice", 20, 2);
      expect(result.current.tracks).toHaveLength(21);
    });

    it("is a no-op while a fetch is already in flight", async () => {
      const getRecentTracks = vi.fn().mockResolvedValue([track("A")]);
      installFakeLastfmApi(getRecentTracks);

      const { result } = renderHook(() => useRecentTracks("alice", 20));
      expect(result.current.loading).toBe(true);

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      // Only the initial fetch fired — refetch() while it was still in flight did
      // nothing.
      expect(getRecentTracks).toHaveBeenCalledTimes(1);
      expect(result.current.refreshing).toBe(false);
    });

    it("keeps existing tracks and lets the user retry after a failed refetch", async () => {
      const getRecentTracks = vi
        .fn()
        .mockResolvedValueOnce([track("A")])
        .mockRejectedValueOnce(new Error("network error"));
      installFakeLastfmApi(getRecentTracks);

      const { result } = renderHook(() => useRecentTracks("alice", 20));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.refetch();
      });
      await waitFor(() => {
        expect(result.current.refreshing).toBe(false);
      });

      expect(result.current.error).toBe("network error");
      expect(result.current.tracks).toEqual([track("A")]);
    });

    it("drops a refetch response that resolves after username has already changed", async () => {
      const alicePage1 = [track("ALICE-0")];
      const staleAliceRefetch = deferred<readonly RecentTrack[]>();
      const getRecentTracks = vi
        .fn()
        .mockResolvedValueOnce(alicePage1)
        .mockReturnValueOnce(staleAliceRefetch.promise)
        .mockResolvedValueOnce([track("BOB-0")]);
      installFakeLastfmApi(getRecentTracks);

      const { result, rerender } = renderHook(({ username }) => useRecentTracks(username, 20), {
        initialProps: { username: "alice" },
      });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.refetch();
      });
      expect(result.current.refreshing).toBe(true);

      rerender({ username: "bob" });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.tracks).toEqual([track("BOB-0")]);

      await act(async () => {
        staleAliceRefetch.resolve([track("ALICE-STALE")]);
        await staleAliceRefetch.promise;
      });

      expect(result.current.tracks).toEqual([track("BOB-0")]);
    });
  });
});

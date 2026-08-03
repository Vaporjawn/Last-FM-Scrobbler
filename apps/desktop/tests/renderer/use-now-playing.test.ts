import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";
import type { NowPlayingApi } from "../../src/shared/now-playing-api.js";
import type { NowPlayingSnapshot } from "../../src/shared/now-playing-snapshot.js";
import { useNowPlaying } from "../../src/renderer/src/hooks/use-now-playing.js";

// This codebase deliberately has no dedicated hook test files for most hooks (see
// use-recent-tracks.test.ts's own note) — useNowPlaying gets one because its
// pull-vs-push race-condition handling is genuinely hook-internal state machinery
// that's hard to drive precisely (exact control over promise-resolution ordering
// relative to push events) through a rendered page's DOM alone.

/** A promise plus its own externally-callable resolve — for tests that need to
 * control exactly when getCurrent() settles relative to a push event. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const TRACK_A: TrackInfo = {
  title: "Weights",
  artist: "Everything Everything",
  sourceApp: "com.apple.Music",
  isStream: false,
};
const TRACK_B: TrackInfo = {
  title: "Distant Past",
  artist: "Everything Everything",
  sourceApp: "com.apple.Music",
  isStream: false,
};

function installFakeNowPlayingApi(getCurrent: NowPlayingApi["getCurrent"]): {
  emitTrackChanged: (track: TrackInfo) => void;
  emitPlaybackStateChanged: (state: PlaybackState) => void;
  emitPositionChanged: (positionSec: number) => void;
} {
  const trackListeners = new Set<(track: TrackInfo) => void>();
  const stateListeners = new Set<(state: PlaybackState) => void>();
  const positionListeners = new Set<(positionSec: number) => void>();

  const api: NowPlayingApi = {
    getCurrent,
    onTrackChanged: (callback) => {
      trackListeners.add(callback);
      return () => trackListeners.delete(callback);
    },
    onPlaybackStateChanged: (callback) => {
      stateListeners.add(callback);
      return () => stateListeners.delete(callback);
    },
    onPositionChanged: (callback) => {
      positionListeners.add(callback);
      return () => positionListeners.delete(callback);
    },
  };
  Object.defineProperty(window, "nowPlaying", { value: api, configurable: true });

  return {
    emitTrackChanged: (track) => {
      for (const listener of trackListeners) listener(track);
    },
    emitPlaybackStateChanged: (state) => {
      for (const listener of stateListeners) listener(state);
    },
    emitPositionChanged: (positionSec) => {
      for (const listener of positionListeners) listener(positionSec);
    },
  };
}

describe("useNowPlaying", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "nowPlaying");
  });

  it("returns the stopped state when window.nowPlaying isn't present", () => {
    const { result } = renderHook(() => useNowPlaying());

    expect(result.current).toEqual({ track: undefined, state: "stopped", positionSec: 0 });
  });

  it("applies the pulled snapshot once it resolves", async () => {
    const snapshot: NowPlayingSnapshot = { track: TRACK_A, state: "playing", positionSec: 12 };
    installFakeNowPlayingApi(vi.fn().mockResolvedValue(snapshot));

    const { result } = renderHook(() => useNowPlaying());

    await waitFor(() => {
      expect(result.current).toEqual(snapshot);
    });
  });

  it("does not let a stale pull response overwrite a track/state pushed before it resolves", async () => {
    // Regression test: getCurrent()'s main-process handler is genuinely slow/
    // variable-latency (a live IPC/D-Bus round trip, or a spawned-process read — see
    // wire-now-playing.ts) — a fast track change can push before the original pull
    // resolves. The pull's eventually-resolved snapshot describes the *old* track
    // (read before the change) and used to unconditionally overwrite the correct,
    // already-pushed new-track state once it landed.
    const pull = deferred<NowPlayingSnapshot>();
    const { emitTrackChanged } = installFakeNowPlayingApi(vi.fn().mockReturnValue(pull.promise));

    const { result } = renderHook(() => useNowPlaying());
    expect(result.current.track).toBeUndefined();

    // Track B starts playing and pushes before the pull (still describing the
    // earlier state, track A) resolves.
    act(() => {
      emitTrackChanged(TRACK_B);
    });
    expect(result.current.track).toEqual(TRACK_B);

    await act(async () => {
      pull.resolve({ track: TRACK_A, state: "stopped", positionSec: 45 });
      await pull.promise;
    });

    // The stale pull must not have overwritten the correct, newer pushed state.
    expect(result.current.track).toEqual(TRACK_B);
  });

  it("still applies the pull when no push has arrived before it resolves", async () => {
    const pull = deferred<NowPlayingSnapshot>();
    installFakeNowPlayingApi(vi.fn().mockReturnValue(pull.promise));

    const { result } = renderHook(() => useNowPlaying());

    await act(async () => {
      pull.resolve({ track: TRACK_A, state: "playing", positionSec: 5 });
      await pull.promise;
    });

    expect(result.current.track).toEqual(TRACK_A);
  });

  it("resets positionSec to 0 immediately on a pushed track change", () => {
    const { emitTrackChanged, emitPositionChanged } = installFakeNowPlayingApi(
      vi.fn().mockReturnValue(new Promise(() => undefined)),
    );

    const { result } = renderHook(() => useNowPlaying());

    act(() => {
      emitTrackChanged(TRACK_A);
      emitPositionChanged(120);
    });
    expect(result.current.positionSec).toBe(120);

    act(() => {
      emitTrackChanged(TRACK_B);
    });

    expect(result.current.positionSec).toBe(0);
  });
});

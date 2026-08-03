import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  PlaybackSource,
  PlaybackState,
  TrackInfo,
  Unsubscribe,
} from "@lastfm-scrobbler/shared-types";
import { compileFilter } from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../../../src/shared/ipc-channels.js";

const ipcMainHandlers = new Map<string, (...args: unknown[]) => unknown>();
const ipcMain = {
  handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    ipcMainHandlers.set(channel, handler);
  }),
  removeHandler: vi.fn((channel: string) => {
    ipcMainHandlers.delete(channel);
  }),
};

vi.mock("electron", () => ({ ipcMain, default: { ipcMain } }));

const { wireNowPlaying } = await import("../../../src/main/playback/wire-now-playing.js");

/** Minimal fake `PlaybackSource` whose emit* helpers drive real listener callbacks,
 * exactly like a real adapter would — no mocking of `PlaybackSource` itself. */
function createFakeSource(): {
  source: PlaybackSource;
  emitTrackChanged: (track: TrackInfo) => void;
  emitPlaybackStateChanged: (state: PlaybackState) => void;
  trackListenerCount: () => number;
  stateListenerCount: () => number;
} {
  const trackListeners = new Set<(track: TrackInfo) => void>();
  const stateListeners = new Set<(state: PlaybackState) => void>();

  const source: PlaybackSource = {
    onTrackChanged(callback): Unsubscribe {
      trackListeners.add(callback);
      return () => trackListeners.delete(callback);
    },
    onPlaybackStateChanged(callback): Unsubscribe {
      stateListeners.add(callback);
      return () => stateListeners.delete(callback);
    },
    getPosition: () => Promise.resolve(0),
  };

  return {
    source,
    emitTrackChanged: (track) => {
      for (const listener of trackListeners) listener(track);
    },
    emitPlaybackStateChanged: (state) => {
      for (const listener of stateListeners) listener(state);
    },
    trackListenerCount: () => trackListeners.size,
    stateListenerCount: () => stateListeners.size,
  };
}

function createFakeWindow(): { webContents: { send: ReturnType<typeof vi.fn> } } {
  return { webContents: { send: vi.fn() } };
}

const TRACK: TrackInfo = {
  title: "Weights",
  artist: "Everything Everything",
  album: "Man Alive",
  durationSec: 340,
  sourceApp: "com.apple.Music",
  isStream: false,
};

describe("wireNowPlaying", () => {
  it("relays track changes to the renderer over IPC", () => {
    const { source, emitTrackChanged } = createFakeSource();
    const mainWindow = createFakeWindow();

    const stop = wireNowPlaying(source, mainWindow as never);
    emitTrackChanged(TRACK);

    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.nowPlayingTrackChanged,
      TRACK,
    );
    stop();
  });

  it("relays playback state changes to the renderer over IPC", () => {
    const { source, emitPlaybackStateChanged } = createFakeSource();
    const mainWindow = createFakeWindow();

    const stop = wireNowPlaying(source, mainWindow as never);
    emitPlaybackStateChanged("playing");

    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.nowPlayingStateChanged,
      "playing",
    );
    stop();
  });

  it("answers get-current with the latest known snapshot", async () => {
    const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
    const mainWindow = createFakeWindow();

    const stop = wireNowPlaying(source, mainWindow as never);
    emitTrackChanged(TRACK);
    emitPlaybackStateChanged("playing");

    const handler = ipcMainHandlers.get(IPC_CHANNELS.nowPlayingGetCurrent);
    expect(handler).toBeDefined();
    await expect(handler?.()).resolves.toEqual({ track: TRACK, state: "playing", positionSec: 0 });
    stop();
  });

  it("answers get-current with stopped/undefined before anything has played", async () => {
    const { source } = createFakeSource();
    const mainWindow = createFakeWindow();

    const stop = wireNowPlaying(source, mainWindow as never);

    const handler = ipcMainHandlers.get(IPC_CHANNELS.nowPlayingGetCurrent);
    await expect(handler?.()).resolves.toEqual({
      track: undefined,
      state: "stopped",
      positionSec: 0,
    });
    stop();
  });

  it("answers get-current with the source's real position, not always 0", async () => {
    const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
    const mainWindow = createFakeWindow();
    source.getPosition = () => Promise.resolve(123.4);

    const stop = wireNowPlaying(source, mainWindow as never);
    emitTrackChanged(TRACK);
    emitPlaybackStateChanged("playing");

    const handler = ipcMainHandlers.get(IPC_CHANNELS.nowPlayingGetCurrent);
    await expect(handler?.()).resolves.toEqual({
      track: TRACK,
      state: "playing",
      positionSec: 123.4,
    });
    stop();
  });

  it("calls the injected onTrackChanged (via the Tracker) when a new track starts", () => {
    const { source, emitTrackChanged } = createFakeSource();
    const mainWindow = createFakeWindow();
    const onTrackChanged = vi.fn();

    const stop = wireNowPlaying(source, mainWindow as never, undefined, onTrackChanged);
    emitTrackChanged(TRACK);

    expect(onTrackChanged).toHaveBeenCalledWith(
      expect.objectContaining({ track: TRACK }),
    );
    stop();
  });

  it("does not call onTrackChanged again for the exact same track (no real change)", () => {
    const { source, emitTrackChanged } = createFakeSource();
    const mainWindow = createFakeWindow();
    const onTrackChanged = vi.fn();

    const stop = wireNowPlaying(source, mainWindow as never, undefined, onTrackChanged);
    emitTrackChanged(TRACK);
    emitTrackChanged(TRACK);

    expect(onTrackChanged).toHaveBeenCalledOnce();
    stop();
  });

  it("never calls onTrackChanged for a track matching the filter", () => {
    // Coverage for onScrobbleEligible specifically being suppressed too lives in
    // packages/core's own Tracker test suite (it needs to advance past the
    // eligibility threshold via manual tick() calls, which isn't meaningful to
    // duplicate here) — Tracker checks the filter in the same place
    // (handleTrackChanged, before either callback fires) for both, so onTrackChanged
    // being suppressed here is a direct signal the filter reached Tracker correctly.
    const { source, emitTrackChanged } = createFakeSource();
    const mainWindow = createFakeWindow();
    const onTrackChanged = vi.fn();
    const filter = compileFilter('sourceApp == "com.apple.Music"');

    const stop = wireNowPlaying(source, mainWindow as never, undefined, onTrackChanged, filter);
    emitTrackChanged(TRACK);

    expect(onTrackChanged).not.toHaveBeenCalled();
    stop();
  });

  it("still relays a filtered-out track to the renderer's Now Playing view unfiltered", () => {
    // The filter only ever affects Tracker (scrobble eligibility) — "what's playing"
    // and "what's eligible to scrobble" are different questions, see wireNowPlaying's
    // own docstring.
    const { source, emitTrackChanged } = createFakeSource();
    const mainWindow = createFakeWindow();
    const filter = compileFilter('sourceApp == "com.apple.Music"');

    const stop = wireNowPlaying(source, mainWindow as never, undefined, undefined, filter);
    emitTrackChanged(TRACK);

    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.nowPlayingTrackChanged,
      TRACK,
    );
    stop();
  });

  it("still calls onTrackChanged for a track that doesn't match the filter", () => {
    const { source, emitTrackChanged } = createFakeSource();
    const mainWindow = createFakeWindow();
    const onTrackChanged = vi.fn();
    const filter = compileFilter('sourceApp == "spotify"');

    const stop = wireNowPlaying(source, mainWindow as never, undefined, onTrackChanged, filter);
    emitTrackChanged(TRACK);

    expect(onTrackChanged).toHaveBeenCalledWith(expect.objectContaining({ track: TRACK }));
    stop();
  });

  it("unsubscribes from the source's track/state listeners on stop", () => {
    // Regression test: `source` is normally a shared, module-level singleton that
    // outlives any one window (see main/index.ts) — the cleanup returned by
    // wireNowPlaying used to only stop the tracker/tick timer/get-current handler,
    // never actually unsubscribing from the source itself. Every window recreation
    // left the previous, destroyed window's `webContents.send` callback still
    // subscribed, throwing the next time a track/state change fired it.
    const { source, trackListenerCount, stateListenerCount } = createFakeSource();
    const mainWindow = createFakeWindow();

    // Two of each: wireNowPlaying's own relay-to-renderer subscription, plus the
    // Tracker's independent subscription (tracker.start() inside wireNowPlaying).
    const stop = wireNowPlaying(source, mainWindow as never);
    expect(trackListenerCount()).toBe(2);
    expect(stateListenerCount()).toBe(2);

    stop();

    expect(trackListenerCount()).toBe(0);
    expect(stateListenerCount()).toBe(0);
  });

  it("removes the get-current handler on stop", () => {
    const { source } = createFakeSource();
    const mainWindow = createFakeWindow();

    const stop = wireNowPlaying(source, mainWindow as never);
    expect(ipcMainHandlers.has(IPC_CHANNELS.nowPlayingGetCurrent)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.nowPlayingGetCurrent)).toBe(false);
  });

  describe("playback position", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("pushes a position update over IPC on each tick while playing", async () => {
      vi.useFakeTimers();
      const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
      source.getPosition = () => Promise.resolve(42);
      const mainWindow = createFakeWindow();

      const stop = wireNowPlaying(source, mainWindow as never);
      emitTrackChanged(TRACK);
      emitPlaybackStateChanged("playing");

      await vi.advanceTimersByTimeAsync(1000);

      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        IPC_CHANNELS.nowPlayingPositionChanged,
        42,
      );
      stop();
    });

    it("does not poll or push position while paused", async () => {
      vi.useFakeTimers();
      const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
      const getPosition = vi.fn().mockResolvedValue(42);
      source.getPosition = getPosition;
      const mainWindow = createFakeWindow();

      const stop = wireNowPlaying(source, mainWindow as never);
      emitTrackChanged(TRACK);
      emitPlaybackStateChanged("paused");

      await vi.advanceTimersByTimeAsync(1000);

      expect(getPosition).not.toHaveBeenCalled();
      expect(mainWindow.webContents.send).not.toHaveBeenCalledWith(
        IPC_CHANNELS.nowPlayingPositionChanged,
        expect.anything(),
      );
      stop();
    });

    it("does not poll or push position while stopped (nothing playing)", async () => {
      vi.useFakeTimers();
      const { source } = createFakeSource();
      const getPosition = vi.fn().mockResolvedValue(42);
      source.getPosition = getPosition;
      const mainWindow = createFakeWindow();

      const stop = wireNowPlaying(source, mainWindow as never);

      await vi.advanceTimersByTimeAsync(1000);

      expect(getPosition).not.toHaveBeenCalled();
      stop();
    });

    it("keeps pushing an updated position on every subsequent tick while still playing", async () => {
      vi.useFakeTimers();
      const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
      let position = 0;
      source.getPosition = () => Promise.resolve(position);
      const mainWindow = createFakeWindow();

      const stop = wireNowPlaying(source, mainWindow as never);
      emitTrackChanged(TRACK);
      emitPlaybackStateChanged("playing");

      position = 1;
      await vi.advanceTimersByTimeAsync(1000);
      position = 2;
      await vi.advanceTimersByTimeAsync(1000);

      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        IPC_CHANNELS.nowPlayingPositionChanged,
        1,
      );
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        IPC_CHANNELS.nowPlayingPositionChanged,
        2,
      );
      stop();
    });

    it("stops polling position once stop() is called", async () => {
      vi.useFakeTimers();
      const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
      const getPosition = vi.fn().mockResolvedValue(5);
      source.getPosition = getPosition;
      const mainWindow = createFakeWindow();

      const stop = wireNowPlaying(source, mainWindow as never);
      emitTrackChanged(TRACK);
      emitPlaybackStateChanged("playing");
      stop();

      await vi.advanceTimersByTimeAsync(5000);

      expect(getPosition).not.toHaveBeenCalled();
    });

    it("doesn't crash the tick loop when getPosition rejects", async () => {
      // Defensive-only path — every current adapter's getPosition() already never
      // rejects (see wireNowPlaying's own comment on this catch), but the tick
      // interval itself must keep running (and the scrobble tracker with it) even if
      // a future/misbehaving adapter's getPosition() ever did.
      vi.useFakeTimers();
      const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
      source.getPosition = vi
        .fn()
        .mockRejectedValueOnce(new Error("transient error"))
        .mockResolvedValue(7);
      const mainWindow = createFakeWindow();

      const stop = wireNowPlaying(source, mainWindow as never);
      emitTrackChanged(TRACK);
      emitPlaybackStateChanged("playing");

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);

      // The second tick's successful position still reaches the renderer — one
      // rejected poll doesn't permanently break the interval.
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        IPC_CHANNELS.nowPlayingPositionChanged,
        7,
      );
      stop();
    });
  });
});

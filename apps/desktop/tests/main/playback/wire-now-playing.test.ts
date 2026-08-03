import { describe, expect, it, vi } from "vitest";
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

  it("answers get-current with the latest known snapshot", () => {
    const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
    const mainWindow = createFakeWindow();

    const stop = wireNowPlaying(source, mainWindow as never);
    emitTrackChanged(TRACK);
    emitPlaybackStateChanged("playing");

    const handler = ipcMainHandlers.get(IPC_CHANNELS.nowPlayingGetCurrent);
    expect(handler).toBeDefined();
    expect(handler?.()).toEqual({ track: TRACK, state: "playing" });
    stop();
  });

  it("answers get-current with stopped/undefined before anything has played", () => {
    const { source } = createFakeSource();
    const mainWindow = createFakeWindow();

    const stop = wireNowPlaying(source, mainWindow as never);

    const handler = ipcMainHandlers.get(IPC_CHANNELS.nowPlayingGetCurrent);
    expect(handler?.()).toEqual({ track: undefined, state: "stopped" });
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

  it("removes the get-current handler on stop", () => {
    const { source } = createFakeSource();
    const mainWindow = createFakeWindow();

    const stop = wireNowPlaying(source, mainWindow as never);
    expect(ipcMainHandlers.has(IPC_CHANNELS.nowPlayingGetCurrent)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.nowPlayingGetCurrent)).toBe(false);
  });
});

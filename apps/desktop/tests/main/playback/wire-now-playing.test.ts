import { describe, expect, it, vi } from "vitest";
import type {
  PlaybackSource,
  PlaybackState,
  TrackInfo,
  Unsubscribe,
} from "@lastfm-scrobbler/shared-types";
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

vi.mock("electron", () => ({ ipcMain }));

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

  it("removes the get-current handler on stop", () => {
    const { source } = createFakeSource();
    const mainWindow = createFakeWindow();

    const stop = wireNowPlaying(source, mainWindow as never);
    expect(ipcMainHandlers.has(IPC_CHANNELS.nowPlayingGetCurrent)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.nowPlayingGetCurrent)).toBe(false);
  });
});

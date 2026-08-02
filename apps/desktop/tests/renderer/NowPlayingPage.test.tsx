import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";
import type { NowPlayingApi } from "../../src/shared/now-playing-api.js";
import { NowPlayingPage } from "../../src/renderer/src/pages/NowPlayingPage.js";

const TRACK: TrackInfo = {
  title: "Weights",
  artist: "Everything Everything",
  album: "Man Alive",
  durationSec: 340,
  sourceApp: "com.apple.Music",
  isStream: false,
};

/** Fake `window.nowPlaying` whose emit* helpers drive real subscribed callbacks. */
function installFakeNowPlayingApi(initial: {
  track: TrackInfo | undefined;
  state: PlaybackState;
}): {
  emitTrackChanged: (track: TrackInfo) => void;
  emitPlaybackStateChanged: (state: PlaybackState) => void;
} {
  const trackListeners = new Set<(track: TrackInfo) => void>();
  const stateListeners = new Set<(state: PlaybackState) => void>();

  const api: NowPlayingApi = {
    getCurrent: () => Promise.resolve(initial),
    onTrackChanged: (callback) => {
      trackListeners.add(callback);
      return () => trackListeners.delete(callback);
    },
    onPlaybackStateChanged: (callback) => {
      stateListeners.add(callback);
      return () => stateListeners.delete(callback);
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
  };
}

describe("NowPlayingPage", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "nowPlaying");
  });

  it("shows 'nothing is playing' when window.nowPlaying is unavailable", () => {
    render(<NowPlayingPage />);

    expect(screen.getByText("Nothing is playing right now.")).toBeInTheDocument();
  });

  it("shows the current track pulled on mount", async () => {
    installFakeNowPlayingApi({ track: TRACK, state: "playing" });

    render(<NowPlayingPage />);

    expect(await screen.findByText("Weights")).toBeInTheDocument();
    expect(screen.getByText("Everything Everything")).toBeInTheDocument();
    expect(screen.getByText("Man Alive")).toBeInTheDocument();
    expect(screen.getByText("Playing")).toBeInTheDocument();
  });

  it("updates when a track-changed event arrives after mount", async () => {
    const { emitTrackChanged } = installFakeNowPlayingApi({ track: undefined, state: "stopped" });

    render(<NowPlayingPage />);
    expect(await screen.findByText("Nothing is playing right now.")).toBeInTheDocument();

    act(() => {
      emitTrackChanged(TRACK);
    });

    expect(await screen.findByText("Weights")).toBeInTheDocument();
  });

  it("updates when a playback-state-changed event arrives after mount", async () => {
    const { emitPlaybackStateChanged } = installFakeNowPlayingApi({
      track: TRACK,
      state: "playing",
    });

    render(<NowPlayingPage />);
    expect(await screen.findByText("Playing")).toBeInTheDocument();

    act(() => {
      emitPlaybackStateChanged("paused");
    });

    expect(await screen.findByText("Paused")).toBeInTheDocument();
  });
});

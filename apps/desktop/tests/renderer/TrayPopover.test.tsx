import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";
import type { AppInfoApi } from "../../src/shared/app-info-api.js";
import type { NowPlayingApi } from "../../src/shared/now-playing-api.js";
import { TrayPopover } from "../../src/renderer/src/TrayPopover.js";

const TRACK: TrackInfo = {
  title: "Weights",
  artist: "Everything Everything",
  sourceApp: "com.apple.Music",
  isStream: false,
};

function unsubscribe(): void {
  // No-op — this test never actually drives track/state-change push events, only the
  // initial `getCurrent()` snapshot, so there's nothing to clean up on unmount.
}

function installFakeNowPlayingApi(initial: { track: TrackInfo | undefined; state: PlaybackState }): void {
  const api: NowPlayingApi = {
    getCurrent: () => Promise.resolve({ ...initial, positionSec: 0 }),
    onTrackChanged: () => unsubscribe,
    onPlaybackStateChanged: () => unsubscribe,
    onPositionChanged: () => unsubscribe,
  };
  Object.defineProperty(window, "nowPlaying", { value: api, configurable: true });
}

function installFakeAppInfoApi(showMainWindow: AppInfoApi["showMainWindow"]): void {
  const api: AppInfoApi = { getVersion: vi.fn().mockResolvedValue("1.0.0"), showMainWindow };
  Object.defineProperty(window, "appInfo", { value: api, configurable: true });
}

describe("TrayPopover", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "nowPlaying");
    Reflect.deleteProperty(window, "appInfo");
  });

  it("shows a 'nothing playing' message when nothing is playing", async () => {
    installFakeNowPlayingApi({ track: undefined, state: "stopped" });

    render(<TrayPopover />);

    expect(await screen.findByText("Nothing playing right now.")).toBeInTheDocument();
  });

  it("shows the current track's title, artist, and source app", async () => {
    installFakeNowPlayingApi({ track: TRACK, state: "playing" });

    render(<TrayPopover />);

    expect(await screen.findByText("Weights")).toBeInTheDocument();
    expect(screen.getByText("Everything Everything")).toBeInTheDocument();
    expect(screen.getByText("com.apple.Music")).toBeInTheDocument();
  });

  it("calls appInfo.showMainWindow when 'Open App' is clicked", async () => {
    installFakeNowPlayingApi({ track: undefined, state: "stopped" });
    const showMainWindow = vi.fn().mockResolvedValue(undefined);
    installFakeAppInfoApi(showMainWindow);

    render(<TrayPopover />);

    fireEvent.click(await screen.findByRole("button", { name: /open app/i }));

    expect(showMainWindow).toHaveBeenCalledOnce();
  });

  it("doesn't throw when window.appInfo is unavailable", () => {
    installFakeNowPlayingApi({ track: undefined, state: "stopped" });

    render(<TrayPopover />);

    expect(() => {
      fireEvent.click(screen.getByRole("button", { name: /open app/i }));
    }).not.toThrow();
  });
});

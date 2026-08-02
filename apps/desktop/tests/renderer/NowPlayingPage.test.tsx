import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";
import type { LastfmDataApi } from "../../src/shared/lastfm-api.js";
import type { NowPlayingApi } from "../../src/shared/now-playing-api.js";
import { SnackbarProvider } from "../../src/renderer/src/contexts/SnackbarProvider.js";
import { NowPlayingPage } from "../../src/renderer/src/pages/NowPlayingPage.js";

/** `NowPlayingPage` fires snackbars via `useSnackbar()` on love/unlove/addTags — a real
 * `SnackbarProvider` (not present in a bare `render(<NowPlayingPage />)`) is needed for
 * those to actually render and be assertable. */
function renderWithSnackbar(): ReturnType<typeof render> {
  return render(
    <SnackbarProvider>
      <NowPlayingPage />
    </SnackbarProvider>,
  );
}

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

function installFakeLastfmApi(overrides: Partial<LastfmDataApi> = {}): LastfmDataApi {
  const api: LastfmDataApi = {
    getRecentTracks: vi.fn().mockResolvedValue([]),
    getTopArtists: vi.fn().mockResolvedValue([]),
    getFriends: vi.fn().mockResolvedValue([]),
    getUserInfo: vi.fn().mockResolvedValue({ username: "someuser" }),
    getArtistInfo: vi.fn().mockResolvedValue({
      name: "Everything Everything",
      bioSummary: "A British art-rock band. <a href=\"https://last.fm\">Read more</a>",
      listeners: 123_456,
      playCount: 7_890_123,
    }),
    getSimilarArtists: vi.fn().mockResolvedValue([{ name: "Alt-J", match: 0.8 }]),
    loveTrack: vi.fn().mockResolvedValue(undefined),
    unloveTrack: vi.fn().mockResolvedValue(undefined),
    addTags: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  Object.defineProperty(window, "lastfm", { value: api, configurable: true });
  return api;
}

describe("NowPlayingPage", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "nowPlaying");
    Reflect.deleteProperty(window, "lastfm");
  });

  it("shows 'nothing is playing' when window.nowPlaying is unavailable", () => {
    render(<NowPlayingPage />);

    expect(screen.getByText("Nothing is playing right now.")).toBeInTheDocument();
  });

  it("shows the current track pulled on mount", async () => {
    installFakeNowPlayingApi({ track: TRACK, state: "playing" });

    render(<NowPlayingPage />);

    expect(await screen.findByText("Weights")).toBeInTheDocument();
    expect(screen.getByText(/by everything everything/i)).toBeInTheDocument();
    expect(screen.getByText(/from man alive/i)).toBeInTheDocument();
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

  it("shows a friendly source-app name in the header", async () => {
    installFakeNowPlayingApi({ track: TRACK, state: "playing" });

    render(<NowPlayingPage />);

    expect(await screen.findByText("Apple Music")).toBeInTheDocument();
  });

  describe("artist info panel", () => {
    it("shows the bio (HTML stripped), listener/play stats, and similar artists", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeLastfmApi();

      render(<NowPlayingPage />);

      expect(await screen.findByText(/a british art-rock band\./i)).toBeInTheDocument();
      expect(screen.queryByText(/read more$/i)).not.toBeInTheDocument();
      expect(screen.getByText("123,456")).toBeInTheDocument();
      expect(screen.getByText("7,890,123")).toBeInTheDocument();
      expect(screen.getByText("Alt-J")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /read more on last\.fm/i }),
      ).toHaveAttribute("href", "https://www.last.fm/music/Everything%20Everything");
    });

    it("shows a fallback message when the artist lookup returns nothing useful", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeLastfmApi({
        getArtistInfo: vi.fn().mockRejectedValue(new Error("not found")),
      });

      render(<NowPlayingPage />);

      expect(await screen.findByText(/no additional artist info available/i)).toBeInTheDocument();
    });
  });

  describe("love/unlove", () => {
    it("loves the track when the heart button is clicked, then unloves on a second click", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      const loveTrack = vi.fn().mockResolvedValue(undefined);
      const unloveTrack = vi.fn().mockResolvedValue(undefined);
      installFakeLastfmApi({ loveTrack, unloveTrack });

      render(<NowPlayingPage />);
      const loveButton = await screen.findByRole("button", { name: /love this track/i });

      act(() => {
        fireEvent.click(loveButton);
      });
      await waitFor(() => {
        expect(loveTrack).toHaveBeenCalledWith("Everything Everything", "Weights");
      });

      const unloveButton = await screen.findByRole("button", { name: /unlove this track/i });
      act(() => {
        fireEvent.click(unloveButton);
      });
      await waitFor(() => {
        expect(unloveTrack).toHaveBeenCalledWith("Everything Everything", "Weights");
      });
    });

    it("shows a success snackbar after loving, then another after unloving", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeLastfmApi();

      renderWithSnackbar();
      const loveButton = await screen.findByRole("button", { name: /love this track/i });
      act(() => {
        fireEvent.click(loveButton);
      });

      expect(await screen.findByText("Loved.")).toBeInTheDocument();

      const unloveButton = await screen.findByRole("button", { name: /unlove this track/i });
      act(() => {
        fireEvent.click(unloveButton);
      });

      expect(await screen.findByText("Unloved.")).toBeInTheDocument();
    });

    it("shows an error snackbar when loving fails", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeLastfmApi({ loveTrack: vi.fn().mockRejectedValue(new Error("not logged in")) });

      renderWithSnackbar();
      const loveButton = await screen.findByRole("button", { name: /love this track/i });
      act(() => {
        fireEvent.click(loveButton);
      });

      expect(await screen.findByText("not logged in")).toBeInTheDocument();
    });
  });

  describe("tagging", () => {
    it("submits comma-separated tags via the tag popover", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      const addTags = vi.fn().mockResolvedValue(undefined);
      installFakeLastfmApi({ addTags });

      render(<NowPlayingPage />);
      const tagButton = await screen.findByRole("button", { name: /add tags/i });
      act(() => {
        fireEvent.click(tagButton);
      });

      const input = await screen.findByPlaceholderText(/tags, separated, by commas/i);
      fireEvent.change(input, { target: { value: "chill, favorite " } });
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
      });

      await waitFor(() => {
        expect(addTags).toHaveBeenCalledWith("Everything Everything", "Weights", ["chill", "favorite"]);
      });
    });

    it("shows a success snackbar once tags are added", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeLastfmApi();

      renderWithSnackbar();
      const tagButton = await screen.findByRole("button", { name: /add tags/i });
      act(() => {
        fireEvent.click(tagButton);
      });
      const input = await screen.findByPlaceholderText(/tags, separated, by commas/i);
      fireEvent.change(input, { target: { value: "chill" } });
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
      });

      expect(await screen.findByText("Tags added.")).toBeInTheDocument();
    });
  });
});

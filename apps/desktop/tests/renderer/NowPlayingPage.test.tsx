import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";
import type { TrackDetail } from "@lastfm-scrobbler/core";
import type { AuthApi } from "../../src/shared/auth-api.js";
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

// Built via rest-destructuring (not `{ ...TRACK, durationSec: undefined }`) because
// `exactOptionalPropertyTypes` rejects explicitly assigning `undefined` to an optional
// property — omitting the key entirely is the valid way to express "no duration".
const { durationSec: _durationSec, ...TRACK_WITHOUT_DURATION } = TRACK;

/** Fake `window.nowPlaying` whose emit* helpers drive real subscribed callbacks.
 * `positionSec` on `initial` is optional (defaulting to 0) so every existing call
 * site that doesn't care about playback position doesn't need to specify one. */
function installFakeNowPlayingApi(initial: {
  track: TrackInfo | undefined;
  state: PlaybackState;
  positionSec?: number;
}): {
  emitTrackChanged: (track: TrackInfo) => void;
  emitPlaybackStateChanged: (state: PlaybackState) => void;
  emitPositionChanged: (positionSec: number) => void;
} {
  const trackListeners = new Set<(track: TrackInfo) => void>();
  const stateListeners = new Set<(state: PlaybackState) => void>();
  const positionListeners = new Set<(positionSec: number) => void>();

  const api: NowPlayingApi = {
    getCurrent: () => Promise.resolve({ ...initial, positionSec: initial.positionSec ?? 0 }),
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

/** No `imageUrl` — the "Last.fm has no art for this track" case — so every existing
 * test in this file that doesn't care about artwork keeps exercising the (correct,
 * unremarkable) fallback path by default. */
const DEFAULT_TRACK_DETAIL: TrackDetail = {
  artist: TRACK.artist,
  track: TRACK.title,
  listeners: 0,
  playCount: 0,
  loved: false,
  url: "https://www.last.fm/music/Everything+Everything/_/Weights",
};

function installFakeLastfmApi(overrides: Partial<LastfmDataApi> = {}): LastfmDataApi {
  const api: LastfmDataApi = {
    getRecentTracks: vi.fn().mockResolvedValue([]),
    getTopArtists: vi.fn().mockResolvedValue([]),
    getTopTracks: vi.fn().mockResolvedValue([]),
    getTopAlbums: vi.fn().mockResolvedValue([]),
    getFriends: vi.fn().mockResolvedValue([]),
    getUserInfo: vi.fn().mockResolvedValue({ username: "someuser" }),
    getLovedTracksCount: vi.fn().mockResolvedValue(0),
    getArtistInfo: vi.fn().mockResolvedValue({
      name: "Everything Everything",
      bioSummary: "A British art-rock band. <a href=\"https://last.fm\">Read more</a>",
      listeners: 123_456,
      playCount: 7_890_123,
    }),
    getSimilarArtists: vi.fn().mockResolvedValue([{ name: "Alt-J", match: 0.8 }]),
    getTopTags: vi.fn().mockResolvedValue([]),
    getTrackInfo: vi.fn().mockResolvedValue(DEFAULT_TRACK_DETAIL),
    loveTrack: vi.fn().mockResolvedValue(undefined),
    unloveTrack: vi.fn().mockResolvedValue(undefined),
    addTags: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  Object.defineProperty(window, "lastfm", { value: api, configurable: true });
  return api;
}

/** `useAuth()` resolves `activeAccount` from `window.auth.getActiveAccount()` — not
 * installed by default in this file (unlike `nowPlaying`/`lastfm`) since most tests
 * here don't care about login state. */
function installFakeAuthApi(activeAccount: string | undefined): void {
  const auth: AuthApi = {
    isConfigured: vi.fn().mockResolvedValue(true),
    credentialsSource: vi.fn().mockResolvedValue("environment"),
    login: vi.fn(),
    logout: vi.fn(),
    listAccounts: vi.fn().mockResolvedValue(activeAccount ? [activeAccount] : []),
    getActiveAccount: vi.fn().mockResolvedValue(activeAccount),
    setActiveAccount: vi.fn(),
    setAppCredentials: vi.fn(),
    clearAppCredentials: vi.fn(),
    relaunch: vi.fn(),
  };
  Object.defineProperty(window, "auth", { value: auth, configurable: true });
}

describe("NowPlayingPage", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "nowPlaying");
    Reflect.deleteProperty(window, "lastfm");
    Reflect.deleteProperty(window, "auth");
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

  describe("artwork", () => {
    it("renders Last.fm's real track art when it has one on file", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeLastfmApi({
        getTrackInfo: vi.fn().mockResolvedValue({
          ...DEFAULT_TRACK_DETAIL,
          imageUrl: "https://lastfm.freetls.fastly.net/i/u/300x300/weights.png",
        }),
      });

      render(<NowPlayingPage />);

      const artwork = await screen.findByAltText("Weights");
      expect(artwork).toHaveAttribute(
        "src",
        "https://lastfm.freetls.fastly.net/i/u/300x300/weights.png",
      );
    });

    it("falls back to the placeholder artwork when the track has no real art", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeLastfmApi();

      render(<NowPlayingPage />);

      await screen.findByText("Weights");
      expect(screen.queryByAltText("Weights")).not.toBeInTheDocument();
    });

    it("falls back to the placeholder artwork when the track-info lookup fails", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeLastfmApi({ getTrackInfo: vi.fn().mockRejectedValue(new Error("network error")) });

      render(<NowPlayingPage />);

      await screen.findByText("Weights");
      expect(screen.queryByAltText("Weights")).not.toBeInTheDocument();
    });
  });

  describe("track stats", () => {
    it("shows the track's listener/play stats and a 'View on Last.fm' link when available", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeLastfmApi({
        getTrackInfo: vi.fn().mockResolvedValue({
          ...DEFAULT_TRACK_DETAIL,
          listeners: 45_000,
          playCount: 210_000,
          url: "https://www.last.fm/music/Everything+Everything/_/Weights",
        }),
      });

      render(<NowPlayingPage />);

      expect(await screen.findByText("45,000")).toBeInTheDocument();
      expect(screen.getByText("210,000")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /view on last\.fm/i })).toHaveAttribute(
        "href",
        "https://www.last.fm/music/Everything+Everything/_/Weights",
      );
    });

    it("doesn't show track stats or a Last.fm link when the lookup fails", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeLastfmApi({ getTrackInfo: vi.fn().mockRejectedValue(new Error("network error")) });

      render(<NowPlayingPage />);

      await screen.findByText("Weights");
      expect(screen.queryByRole("link", { name: /view on last\.fm/i })).not.toBeInTheDocument();
    });

    it("shows the logged-in account's own play count for the track when Last.fm has one", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeAuthApi("alice");
      const getTrackInfo = vi.fn().mockResolvedValue({ ...DEFAULT_TRACK_DETAIL, userPlayCount: 7 });
      installFakeLastfmApi({ getTrackInfo });

      render(<NowPlayingPage />);

      expect(await screen.findByText("You've listened to this track 7 times.")).toBeInTheDocument();
      expect(getTrackInfo).toHaveBeenCalledWith("Everything Everything", "Weights", "alice");
    });

    it("uses singular wording for exactly one play", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeAuthApi("alice");
      installFakeLastfmApi({
        getTrackInfo: vi.fn().mockResolvedValue({ ...DEFAULT_TRACK_DETAIL, userPlayCount: 1 }),
      });

      render(<NowPlayingPage />);

      expect(await screen.findByText("You've listened to this track 1 time.")).toBeInTheDocument();
    });

    it("doesn't show a personal play count when nobody is logged in", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeAuthApi(undefined);
      // Mirrors the real API/client contract (see TrackDetail.userPlayCount's
      // docstring): `userPlayCount` is only ever present when `getTrackInfo` was
      // called with a username, so a faithful fake — unlike one that always returns
      // it — only includes it in that case, same as `LastfmClient.getTrackInfo`'s own
      // conditional-spread parsing.
      const getTrackInfo = vi
        .fn()
        .mockImplementation((_artist: string, _track: string, username?: string) =>
          Promise.resolve({ ...DEFAULT_TRACK_DETAIL, ...(username ? { userPlayCount: 7 } : {}) }),
        );
      installFakeLastfmApi({ getTrackInfo });

      render(<NowPlayingPage />);

      // getTrackInfo is still called (without a username) once the stats fetch
      // resolves — assert on that instead of a fixed timeout, then confirm no
      // personal-play-count line rendered.
      await waitFor(() => {
        expect(getTrackInfo).toHaveBeenCalledWith("Everything Everything", "Weights", undefined);
      });
      expect(screen.queryByText(/you've listened to this track/i)).not.toBeInTheDocument();
    });

    it("doesn't show a personal play count when Last.fm has none on file for this account", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeAuthApi("alice");
      installFakeLastfmApi();

      render(<NowPlayingPage />);

      await screen.findByText("Weights");
      expect(screen.queryByText(/you've listened to this track/i)).not.toBeInTheDocument();
    });
  });

  describe("state indicator", () => {
    it("uses the animated ScrobblingIndicator (not a static icon) for the 'playing' state", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeLastfmApi();

      const { container } = render(<NowPlayingPage />);
      await screen.findByText("Playing");

      expect(screen.queryByTestId("PlayArrowIcon")).not.toBeInTheDocument();
      const indicator = container.querySelector('.MuiChip-root [aria-hidden="true"]');
      expect(indicator?.tagName).toBe("DIV");
      expect(indicator?.children).toHaveLength(3);
    });

    it("still uses a static icon for the 'paused' state", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "paused" });
      installFakeLastfmApi();

      render(<NowPlayingPage />);
      await screen.findByText("Paused");

      expect(screen.getByTestId("PauseIcon")).toBeInTheDocument();
    });
  });

  describe("duration", () => {
    it("shows the track duration formatted as m:ss", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeLastfmApi();

      render(<NowPlayingPage />);

      expect(await screen.findByText("5:40")).toBeInTheDocument();
    });

    it("doesn't show a duration when the track has none", async () => {
      installFakeNowPlayingApi({ track: TRACK_WITHOUT_DURATION, state: "playing" });
      installFakeLastfmApi();

      render(<NowPlayingPage />);

      await screen.findByText("Weights");
      expect(screen.queryByText(/^\d+:\d{2}$/)).not.toBeInTheDocument();
    });
  });

  describe("playback position", () => {
    it("seeds the progress bar and elapsed time from the initial snapshot", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing", positionSec: 170 });
      installFakeLastfmApi();

      render(<NowPlayingPage />);

      // 170s elapsed of a 340s track is exactly the midpoint.
      const progressBar = await screen.findByRole("progressbar");
      expect(progressBar).toHaveAttribute("aria-valuenow", "50");
      expect(screen.getByText("2:50")).toBeInTheDocument();
      expect(screen.getByText("5:40")).toBeInTheDocument();
    });

    it("updates the progress bar and elapsed time when a position update arrives", async () => {
      const { emitPositionChanged } = installFakeNowPlayingApi({
        track: TRACK,
        state: "playing",
        positionSec: 0,
      });
      installFakeLastfmApi();

      render(<NowPlayingPage />);
      await screen.findByText("0:00");

      act(() => {
        emitPositionChanged(85);
      });

      // 85s of 340s = 25%.
      expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
      expect(screen.getByText("1:25")).toBeInTheDocument();
    });

    it("resets to 0 immediately when the track changes, without waiting for a position push", async () => {
      const { emitTrackChanged, emitPositionChanged } = installFakeNowPlayingApi({
        track: TRACK,
        state: "playing",
        positionSec: 200,
      });
      installFakeLastfmApi();

      render(<NowPlayingPage />);
      await screen.findByText("3:20");

      act(() => {
        emitTrackChanged({ ...TRACK, title: "Cool Blue", durationSec: 200 });
      });

      expect(await screen.findByText("Cool Blue")).toBeInTheDocument();
      expect(screen.getByText("0:00")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

      // Confirms this really is the reset-on-track-change path, not a coincidental
      // leftover render: a later position push for the new track still applies.
      act(() => {
        emitPositionChanged(50);
      });
      expect(await screen.findByText("0:50")).toBeInTheDocument();
    });

    it("clamps the displayed elapsed time and progress to the track's duration", async () => {
      // A position update arriving slightly over duration (e.g. timing jitter at the
      // very end of a track) shouldn't show 101% or an elapsed time past the total.
      const { emitPositionChanged } = installFakeNowPlayingApi({
        track: TRACK,
        state: "playing",
        positionSec: 0,
      });
      installFakeLastfmApi();

      render(<NowPlayingPage />);
      await screen.findByText("0:00");

      act(() => {
        emitPositionChanged(345);
      });

      expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
      // "5:40" appears twice once clamped — the elapsed-time label and the
      // already-existing total-duration label read identically.
      expect(screen.getAllByText("5:40")).toHaveLength(2);
    });

    it("doesn't render a progress bar when the track has no known duration", async () => {
      installFakeNowPlayingApi({ track: TRACK_WITHOUT_DURATION, state: "playing" });
      installFakeLastfmApi();

      render(<NowPlayingPage />);

      await screen.findByText("Weights");
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("doesn't render a progress bar (or divide by zero) for a reported durationSec of exactly 0", async () => {
      // Regression test: the progress bar was previously guarded only by
      // `durationSec !== undefined`, not `> 0` — nothing in the PlaybackSource
      // contract rules out a source reporting `durationSec: 0` for a track with
      // genuinely unknown duration (rather than omitting the field entirely), which
      // divided by zero into a NaN progress-bar value.
      //
      // Checked via the MUI LinearProgress-specific class, not a bare
      // `role: "progressbar"` query — ArtistInfoPanel's own "Loading artist info…"
      // CircularProgress spinner shares that same role and can still legitimately be
      // in the document at this point, which would make a bare role query ambiguous/
      // flaky rather than actually testing the playback progress bar this is about.
      installFakeNowPlayingApi({
        track: { ...TRACK, durationSec: 0 },
        state: "playing",
        positionSec: 0,
      });
      installFakeLastfmApi();

      render(<NowPlayingPage />);

      await screen.findByText("Weights");
      expect(document.querySelector(".MuiLinearProgress-root")).not.toBeInTheDocument();
    });
  });

  describe("login hint", () => {
    it("shows a quiet hint to log in when no account is active", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeAuthApi(undefined);

      render(<NowPlayingPage />);

      expect(await screen.findByText(/log in with last\.fm.*to love or tag tracks/i)).toBeInTheDocument();
    });

    it("hides the hint once an account is active", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeAuthApi("alice");

      render(<NowPlayingPage />);

      await screen.findByText("Weights");
      expect(screen.queryByText(/log in with last\.fm/i)).not.toBeInTheDocument();
    });
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

    it("shows the lookup error rather than silently falling back to 'no info' when it fails", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      installFakeLastfmApi({
        getArtistInfo: vi.fn().mockRejectedValue(new Error("not found")),
      });

      render(<NowPlayingPage />);

      expect(await screen.findByRole("alert")).toHaveTextContent("not found");
      expect(screen.queryByText(/no additional artist info available/i)).not.toBeInTheDocument();
    });

    it("shows a fallback message when there's no lookup to make at all (e.g. no window.lastfm)", async () => {
      // Deliberately no installFakeLastfmApi() call — same "preload script never
      // loaded" scenario covered elsewhere in this file — useArtistInfo resolves to
      // its inert empty state (no error, nothing to show) rather than fetching.
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });

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

  describe("refresh", () => {
    it("re-fetches track stats and artist info when the refresh button is clicked", async () => {
      installFakeNowPlayingApi({ track: TRACK, state: "playing" });
      const getTrackInfo = vi
        .fn()
        .mockResolvedValueOnce({ ...DEFAULT_TRACK_DETAIL, listeners: 1 })
        .mockResolvedValueOnce({ ...DEFAULT_TRACK_DETAIL, listeners: 2 });
      installFakeLastfmApi({ getTrackInfo });

      render(<NowPlayingPage />);
      await screen.findByText("1");

      fireEvent.click(screen.getByRole("button", { name: "Refresh track info" }));

      expect(await screen.findByText("2")).toBeInTheDocument();
      expect(getTrackInfo).toHaveBeenCalledTimes(2);
    });

    it("doesn't show a refresh button when nothing is playing", () => {
      render(<NowPlayingPage />);

      expect(screen.queryByRole("button", { name: "Refresh track info" })).not.toBeInTheDocument();
    });
  });
});

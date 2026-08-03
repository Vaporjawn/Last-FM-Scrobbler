import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecentTrack, TrackDetail } from "@lastfm-scrobbler/core";
import type { LastfmDataApi } from "../../src/shared/lastfm-api.js";
import { SnackbarProvider } from "../../src/renderer/src/contexts/SnackbarProvider.js";
import { ScrobbleDetailPage } from "../../src/renderer/src/pages/ScrobbleDetailPage.js";

const TRACK: RecentTrack = {
  artist: "Fleece",
  track: "Under the Light",
  album: "Voyager",
  nowPlaying: false,
  timestamp: 1_700_000_000,
  imageUrl: "https://lastfm.freetls.fastly.net/i/u/300x300/voyager.png",
  loved: false,
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
      name: "Fleece",
      listeners: 260_722,
      playCount: 2_375_774,
      userPlayCount: 80,
    }),
    getSimilarArtists: vi.fn().mockResolvedValue([{ name: "Post Animal", match: 0.9 }]),
    getTopTags: vi.fn().mockResolvedValue(["psychedelic", "Canadian"]),
    getTrackInfo: vi.fn().mockResolvedValue({
      artist: "Fleece",
      track: "Under the Light",
      album: "Voyager",
      listeners: 57_398,
      playCount: 303_244,
      userPlayCount: 4,
      loved: false,
      url: "https://www.last.fm/music/Fleece/_/Under+the+Light",
    }),
    loveTrack: vi.fn().mockResolvedValue(undefined),
    unloveTrack: vi.fn().mockResolvedValue(undefined),
    addTags: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  Object.defineProperty(window, "lastfm", { value: api, configurable: true });
  return api;
}

function renderWithSnackbar(
  props: Partial<{
    track: RecentTrack;
    activeAccount: string | undefined;
    onBack: () => void;
    backLabel: string;
  }> = {},
): ReturnType<typeof render> {
  return render(
    <SnackbarProvider>
      <ScrobbleDetailPage
        track={props.track ?? TRACK}
        activeAccount={"activeAccount" in props ? props.activeAccount : "someuser"}
        onBack={props.onBack ?? vi.fn()}
        {...(props.backLabel ? { backLabel: props.backLabel } : {})}
      />
    </SnackbarProvider>,
  );
}

describe("ScrobbleDetailPage", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "lastfm");
  });

  it("shows the track title, artist, and album immediately from the passed-in track", () => {
    installFakeLastfmApi();

    renderWithSnackbar();

    expect(screen.getByText("Under the Light")).toBeInTheDocument();
    expect(screen.getByText(/by fleece/i)).toBeInTheDocument();
    expect(screen.getByText(/from voyager/i)).toBeInTheDocument();
  });

  describe("playback status", () => {
    it("shows when the track was scrobbled as the shared PlaybackStatusChip", () => {
      installFakeLastfmApi();

      renderWithSnackbar();

      expect(
        screen.getByText(new Date(1_700_000_000 * 1000).toLocaleString()),
      ).toBeInTheDocument();
    });

    it("shows a 'Now Playing' status chip instead of a timestamp for the currently-playing track", () => {
      installFakeLastfmApi();

      renderWithSnackbar({ track: { ...TRACK, nowPlaying: true } });

      expect(screen.getByText("Now Playing")).toBeInTheDocument();
      expect(
        screen.queryByText(new Date(1_700_000_000 * 1000).toLocaleString()),
      ).not.toBeInTheDocument();
    });
  });

  it("calls onBack when 'Back to Scrobbles' is clicked", () => {
    installFakeLastfmApi();
    const onBack = vi.fn();

    renderWithSnackbar({ onBack });

    fireEvent.click(screen.getByRole("button", { name: /back to scrobbles/i }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("labels the back button with backLabel when given (e.g. reached from Friends)", () => {
    installFakeLastfmApi();

    renderWithSnackbar({ backLabel: "Friends" });

    expect(screen.getByRole("button", { name: /back to friends/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /back to scrobbles/i })).not.toBeInTheDocument();
  });

  it("links 'View on Last.fm' to the real track URL once fetched", async () => {
    installFakeLastfmApi();

    renderWithSnackbar();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /view on last\.fm/i })).toHaveAttribute(
        "href",
        "https://www.last.fm/music/Fleece/_/Under+the+Light",
      );
    });
  });

  it("links 'View on Last.fm' to a best-effort URL before track.getInfo resolves", () => {
    installFakeLastfmApi({ getTrackInfo: vi.fn(() => new Promise<TrackDetail>(() => undefined)) });

    renderWithSnackbar();

    expect(screen.getByRole("link", { name: /view on last\.fm/i })).toHaveAttribute(
      "href",
      "https://www.last.fm/music/Fleece/_/Under%20the%20Light",
    );
  });

  describe("personal listening stats", () => {
    it("shows both the artist's and track's personal play counts once both are known", async () => {
      installFakeLastfmApi();

      renderWithSnackbar();

      let statsParagraph: HTMLElement | undefined;
      await waitFor(() => {
        statsParagraph = screen.getByText(/you've listened to/i).closest("p") ?? undefined;
        expect(statsParagraph).toBeTruthy();
      });
      expect(statsParagraph).toHaveTextContent(
        "You've listened to Fleece 80 times and Under the Light 4 times.",
      );
    });

    it("omits the callout entirely when there's no account to attribute stats to", () => {
      installFakeLastfmApi();

      renderWithSnackbar({ activeAccount: undefined });

      expect(screen.queryByText(/you've listened to/i)).not.toBeInTheDocument();
    });
  });

  describe("artist info panel", () => {
    it("shows listener/play stats, popular tags, and similar artists", async () => {
      installFakeLastfmApi();

      renderWithSnackbar();

      expect(await screen.findByText("260,722")).toBeInTheDocument();
      expect(screen.getByText("2,375,774")).toBeInTheDocument();
      expect(screen.getByText("psychedelic")).toBeInTheDocument();
      expect(screen.getByText("Canadian")).toBeInTheDocument();
      expect(screen.getByText("Post Animal")).toBeInTheDocument();
    });

    it("links each popular tag to its Last.fm tag page", async () => {
      installFakeLastfmApi();

      renderWithSnackbar();

      const tag = await screen.findByRole("link", { name: "psychedelic" });
      expect(tag).toHaveAttribute("href", "https://www.last.fm/tag/psychedelic");
    });
  });

  describe("love/unlove", () => {
    it("loves the track when the heart button is clicked", async () => {
      const loveTrack = vi.fn().mockResolvedValue(undefined);
      installFakeLastfmApi({ loveTrack });

      renderWithSnackbar();
      const loveButton = screen.getByRole("button", { name: /love this track/i });
      act(() => {
        fireEvent.click(loveButton);
      });

      await waitFor(() => {
        expect(loveTrack).toHaveBeenCalledWith("Fleece", "Under the Light");
      });
      expect(await screen.findByText("Loved.")).toBeInTheDocument();
    });

    it("seeds the heart as already-loved from the passed-in track", () => {
      installFakeLastfmApi();

      renderWithSnackbar({ track: { ...TRACK, loved: true } });

      expect(screen.getByRole("button", { name: /unlove this track/i })).toBeInTheDocument();
    });
  });

  describe("tagging", () => {
    it("submits comma-separated tags via the tag popover", async () => {
      const addTags = vi.fn().mockResolvedValue(undefined);
      installFakeLastfmApi({ addTags });

      renderWithSnackbar();
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Add tags" }));
      });

      const input = await screen.findByPlaceholderText(/tags, separated, by commas/i);
      fireEvent.change(input, { target: { value: "chill, favorite " } });
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
      });

      await waitFor(() => {
        expect(addTags).toHaveBeenCalledWith("Fleece", "Under the Light", ["chill", "favorite"]);
      });
    });
  });

  describe("refresh", () => {
    it("re-fetches track info, artist info, and top tags when the refresh button is clicked", async () => {
      const getTrackInfo = vi
        .fn()
        .mockResolvedValueOnce({
          artist: "Fleece",
          track: "Under the Light",
          listeners: 1,
          playCount: 1,
          userPlayCount: 4,
          loved: false,
          url: "https://www.last.fm/music/Fleece/_/Under+the+Light",
        })
        .mockResolvedValueOnce({
          artist: "Fleece",
          track: "Under the Light",
          listeners: 1,
          playCount: 1,
          userPlayCount: 9,
          loved: false,
          url: "https://www.last.fm/music/Fleece/_/Under+the+Light",
        });
      installFakeLastfmApi({ getTrackInfo });

      renderWithSnackbar();
      let statsParagraph: HTMLElement | undefined;
      await waitFor(() => {
        statsParagraph = screen.getByText(/you've listened to/i).closest("p") ?? undefined;
        expect(statsParagraph).toHaveTextContent("Under the Light 4 times");
      });

      fireEvent.click(screen.getByRole("button", { name: "Refresh track info" }));

      await waitFor(() => {
        expect(statsParagraph).toHaveTextContent("Under the Light 9 times");
      });
      expect(getTrackInfo).toHaveBeenCalledTimes(2);
    });
  });
});

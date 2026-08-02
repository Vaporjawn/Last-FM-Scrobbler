import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecentTrack } from "@lastfm-scrobbler/core";
import type { AuthApi } from "../../src/shared/auth-api.js";
import type { LastfmDataApi } from "../../src/shared/lastfm-api.js";
import { SnackbarProvider } from "../../src/renderer/src/contexts/SnackbarProvider.js";
import { ScrobblesPage } from "../../src/renderer/src/pages/ScrobblesPage.js";

/** `ScrobblesPage` rows fire snackbars via `useSnackbar()` on love/unlove/addTags — a
 * real `SnackbarProvider` (not present in a bare `render(<ScrobblesPage />)`) is needed
 * for those to actually render and be assertable. */
function renderWithSnackbar(onNavigateToSettings = vi.fn()): ReturnType<typeof render> {
  return render(
    <SnackbarProvider>
      <ScrobblesPage onNavigateToSettings={onNavigateToSettings} />
    </SnackbarProvider>,
  );
}

function installFakeApis(options: {
  activeAccount?: string;
  recentTracks?: readonly RecentTrack[];
  lastfmOverrides?: Partial<LastfmDataApi>;
}): LastfmDataApi {
  const auth: AuthApi = {
    isConfigured: vi.fn().mockResolvedValue(true),
    credentialsSource: vi.fn().mockResolvedValue("environment"),
    login: vi.fn(),
    logout: vi.fn(),
    listAccounts: vi.fn().mockResolvedValue(options.activeAccount ? [options.activeAccount] : []),
    getActiveAccount: vi.fn().mockResolvedValue(options.activeAccount),
    setActiveAccount: vi.fn(),
    setAppCredentials: vi.fn(),
    clearAppCredentials: vi.fn(),
    relaunch: vi.fn(),
  };
  const lastfm: LastfmDataApi = {
    getRecentTracks: vi.fn().mockResolvedValue(options.recentTracks ?? []),
    getTopArtists: vi.fn().mockResolvedValue([]),
    getFriends: vi.fn().mockResolvedValue([]),
    getUserInfo: vi.fn().mockResolvedValue({ username: "someuser" }),
    getArtistInfo: vi.fn(),
    getSimilarArtists: vi.fn(),
    getTopTags: vi.fn(),
    getTrackInfo: vi.fn(),
    loveTrack: vi.fn().mockResolvedValue(undefined),
    unloveTrack: vi.fn().mockResolvedValue(undefined),
    addTags: vi.fn().mockResolvedValue(undefined),
    ...options.lastfmOverrides,
  };
  Object.defineProperty(window, "auth", { value: auth, configurable: true });
  Object.defineProperty(window, "lastfm", { value: lastfm, configurable: true });
  return lastfm;
}

describe("ScrobblesPage", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "auth");
    Reflect.deleteProperty(window, "lastfm");
  });

  it("prompts to log in when no account is active", async () => {
    installFakeApis({});

    render(<ScrobblesPage onNavigateToSettings={vi.fn()} />);

    expect(await screen.findByText(/log in.*settings/i)).toBeInTheDocument();
  });

  it("takes the user to Settings when the login prompt's button is clicked", async () => {
    installFakeApis({});
    const onNavigateToSettings = vi.fn();

    render(<ScrobblesPage onNavigateToSettings={onNavigateToSettings} />);

    fireEvent.click(await screen.findByRole("button", { name: /go to settings/i }));

    expect(onNavigateToSettings).toHaveBeenCalledOnce();
  });

  it("shows recent tracks for the active account", async () => {
    installFakeApis({
      activeAccount: "alice",
      recentTracks: [
        {
          artist: "Aphex Twin",
          track: "Windowlicker",
          nowPlaying: false,
          timestamp: 1_700_000_000,
          loved: false,
        },
        { artist: "Boards of Canada", track: "Roygbiv", nowPlaying: true, loved: false },
      ],
    });

    render(<ScrobblesPage onNavigateToSettings={vi.fn()} />);

    expect(await screen.findByText("Windowlicker")).toBeInTheDocument();
    expect(screen.getByText("Aphex Twin")).toBeInTheDocument();
    expect(screen.getByText("Roygbiv")).toBeInTheDocument();
    expect(screen.getByText(/now playing/i)).toBeInTheDocument();
  });

  it("shows an empty-state message when there are no recent tracks", async () => {
    installFakeApis({ activeAccount: "alice", recentTracks: [] });

    render(<ScrobblesPage onNavigateToSettings={vi.fn()} />);

    expect(await screen.findByText(/no scrobbles yet/i)).toBeInTheDocument();
  });

  describe("album art", () => {
    it("renders Last.fm's artwork as the row's avatar when the track has an imageUrl", async () => {
      installFakeApis({
        activeAccount: "alice",
        recentTracks: [
          {
            artist: "Crumb",
            track: "Ghostride",
            album: "Jinx",
            nowPlaying: false,
            timestamp: 1_700_000_000,
            imageUrl: "https://lastfm.freetls.fastly.net/i/u/300x300/ghostride.png",
            loved: false,
          },
        ],
      });

      render(<ScrobblesPage onNavigateToSettings={vi.fn()} />);

      const artwork = await screen.findByAltText("Ghostride");
      expect(artwork).toHaveAttribute("src", "https://lastfm.freetls.fastly.net/i/u/300x300/ghostride.png");
    });

    it("falls back to the note/play icon when the track has no imageUrl", async () => {
      installFakeApis({
        activeAccount: "alice",
        recentTracks: [{ artist: "Crumb", track: "Ghostride", nowPlaying: false, loved: false }],
      });

      render(<ScrobblesPage onNavigateToSettings={vi.fn()} />);

      await screen.findByText("Ghostride");
      expect(screen.queryByAltText("Ghostride")).not.toBeInTheDocument();
    });
  });

  describe("love/unlove", () => {
    it("loves a track when its heart button is clicked, then unloves it on a second click", async () => {
      const loveTrack = vi.fn().mockResolvedValue(undefined);
      const unloveTrack = vi.fn().mockResolvedValue(undefined);
      installFakeApis({
        activeAccount: "alice",
        recentTracks: [{ artist: "Crumb", track: "Ghostride", nowPlaying: false, loved: false }],
        lastfmOverrides: { loveTrack, unloveTrack },
      });

      render(<ScrobblesPage onNavigateToSettings={vi.fn()} />);
      const loveButton = await screen.findByRole("button", { name: /love ghostride/i });

      act(() => {
        fireEvent.click(loveButton);
      });
      await waitFor(() => {
        expect(loveTrack).toHaveBeenCalledWith("Crumb", "Ghostride");
      });

      const unloveButton = await screen.findByRole("button", { name: /unlove ghostride/i });
      act(() => {
        fireEvent.click(unloveButton);
      });
      await waitFor(() => {
        expect(unloveTrack).toHaveBeenCalledWith("Crumb", "Ghostride");
      });
    });

    it("seeds the heart as already-loved when Last.fm reports the track as loved", async () => {
      installFakeApis({
        activeAccount: "alice",
        recentTracks: [{ artist: "Crumb", track: "Ghostride", nowPlaying: false, loved: true }],
      });

      render(<ScrobblesPage onNavigateToSettings={vi.fn()} />);

      expect(await screen.findByRole("button", { name: /unlove ghostride/i })).toBeInTheDocument();
    });

    it("shows a success snackbar after loving", async () => {
      installFakeApis({
        activeAccount: "alice",
        recentTracks: [{ artist: "Crumb", track: "Ghostride", nowPlaying: false, loved: false }],
      });

      renderWithSnackbar();
      const loveButton = await screen.findByRole("button", { name: /love ghostride/i });
      act(() => {
        fireEvent.click(loveButton);
      });

      expect(await screen.findByText("Loved.")).toBeInTheDocument();
    });

    it("shows an error snackbar when loving fails", async () => {
      installFakeApis({
        activeAccount: "alice",
        recentTracks: [{ artist: "Crumb", track: "Ghostride", nowPlaying: false, loved: false }],
        lastfmOverrides: { loveTrack: vi.fn().mockRejectedValue(new Error("not logged in")) },
      });

      renderWithSnackbar();
      const loveButton = await screen.findByRole("button", { name: /love ghostride/i });
      act(() => {
        fireEvent.click(loveButton);
      });

      expect(await screen.findByText("not logged in")).toBeInTheDocument();
    });

    it("keeps each row's loved state independent", async () => {
      installFakeApis({
        activeAccount: "alice",
        recentTracks: [
          { artist: "Crumb", track: "Ghostride", nowPlaying: false, loved: false },
          { artist: "Joji", track: "SLOW DANCING IN THE DARK", nowPlaying: false, loved: false },
        ],
      });

      render(<ScrobblesPage onNavigateToSettings={vi.fn()} />);
      const loveButton = await screen.findByRole("button", { name: /love ghostride/i });
      act(() => {
        fireEvent.click(loveButton);
      });

      await screen.findByRole("button", { name: /unlove ghostride/i });
      expect(
        screen.getByRole("button", { name: /love slow dancing in the dark/i }),
      ).toBeInTheDocument();
    });
  });

  describe("tagging", () => {
    it("submits comma-separated tags for the right track via its tag popover", async () => {
      const addTags = vi.fn().mockResolvedValue(undefined);
      installFakeApis({
        activeAccount: "alice",
        recentTracks: [{ artist: "Crumb", track: "Ghostride", nowPlaying: false, loved: false }],
        lastfmOverrides: { addTags },
      });

      render(<ScrobblesPage onNavigateToSettings={vi.fn()} />);
      const tagButton = await screen.findByRole("button", { name: /add tags to ghostride/i });
      act(() => {
        fireEvent.click(tagButton);
      });

      const input = await screen.findByPlaceholderText(/tags, separated, by commas/i);
      fireEvent.change(input, { target: { value: "chill, favorite " } });
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
      });

      await waitFor(() => {
        expect(addTags).toHaveBeenCalledWith("Crumb", "Ghostride", ["chill", "favorite"]);
      });
    });

    it("shows a success snackbar once tags are added", async () => {
      installFakeApis({
        activeAccount: "alice",
        recentTracks: [{ artist: "Crumb", track: "Ghostride", nowPlaying: false, loved: false }],
      });

      renderWithSnackbar();
      const tagButton = await screen.findByRole("button", { name: /add tags to ghostride/i });
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

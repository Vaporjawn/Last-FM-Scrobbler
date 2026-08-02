import type { RecentTrack } from "@lastfm-scrobbler/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../../src/shared/auth-api.js";
import type { LastfmDataApi } from "../../src/shared/lastfm-api.js";
import { FriendsPage } from "../../src/renderer/src/pages/FriendsPage.js";

function installFakeApis(options: {
  activeAccount?: string;
  friends?: LastfmDataApi["getFriends"];
  /** Per-friend `getRecentTracks` result, keyed by username — anyone not listed here
   * resolves to `[]` (no activity), matching real Last.fm behavior for a friend with
   * no scrobble history. */
  recentTracksByUser?: Readonly<Record<string, readonly RecentTrack[]>>;
}): void {
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
    getRecentTracks: vi
      .fn()
      .mockImplementation((user: string) =>
        Promise.resolve(options.recentTracksByUser?.[user] ?? []),
      ),
    getTopArtists: vi.fn().mockResolvedValue([]),
    getFriends: options.friends ?? vi.fn().mockResolvedValue([]),
    getUserInfo: vi.fn().mockResolvedValue({ username: "someuser" }),
    getArtistInfo: vi.fn(),
    getSimilarArtists: vi.fn(),
    getTopTags: vi.fn(),
    getTrackInfo: vi.fn(),
    loveTrack: vi.fn(),
    unloveTrack: vi.fn(),
    addTags: vi.fn(),
  };
  Object.defineProperty(window, "auth", { value: auth, configurable: true });
  Object.defineProperty(window, "lastfm", { value: lastfm, configurable: true });
}

describe("FriendsPage", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "auth");
    Reflect.deleteProperty(window, "lastfm");
  });

  it("prompts to log in when no account is active", async () => {
    installFakeApis({});

    render(<FriendsPage onNavigateToSettings={vi.fn()} />);

    expect(await screen.findByText(/log in.*settings/i)).toBeInTheDocument();
  });

  it("takes the user to Settings when the login prompt's button is clicked", async () => {
    installFakeApis({});
    const onNavigateToSettings = vi.fn();

    render(<FriendsPage onNavigateToSettings={onNavigateToSettings} />);

    fireEvent.click(await screen.findByRole("button", { name: /go to settings/i }));

    expect(onNavigateToSettings).toHaveBeenCalledOnce();
  });

  it("shows friends with real names when available", async () => {
    installFakeApis({
      activeAccount: "alice",
      friends: vi
        .fn()
        .mockResolvedValue([{ username: "bob", realName: "Bob Smith" }, { username: "carol" }]),
    });

    render(<FriendsPage onNavigateToSettings={vi.fn()} />);

    expect(await screen.findByText("bob")).toBeInTheDocument();
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    expect(screen.getByText("carol")).toBeInTheDocument();
  });

  it("shows an empty-state message when there are no friends", async () => {
    installFakeApis({ activeAccount: "alice", friends: vi.fn().mockResolvedValue([]) });

    render(<FriendsPage onNavigateToSettings={vi.fn()} />);

    expect(await screen.findByText(/no friends/i)).toBeInTheDocument();
  });

  it("renders each friend's real avatar photo when Last.fm has one on file", async () => {
    installFakeApis({
      activeAccount: "alice",
      friends: vi.fn().mockResolvedValue([
        { username: "bob", avatarUrl: "https://lastfm.freetls.fastly.net/i/u/300x300/bob.png" },
      ]),
    });

    render(<FriendsPage onNavigateToSettings={vi.fn()} />);

    const avatarImg = await screen.findByRole("img", { name: "bob" });
    expect(avatarImg).toHaveAttribute("src", "https://lastfm.freetls.fastly.net/i/u/300x300/bob.png");
  });

  it("falls back to a letter avatar for a friend with no photo set", async () => {
    installFakeApis({
      activeAccount: "alice",
      friends: vi.fn().mockResolvedValue([{ username: "bob" }]),
    });

    render(<FriendsPage onNavigateToSettings={vi.fn()} />);

    await screen.findByText("bob");
    expect(screen.queryByRole("img", { name: "bob" })).not.toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("shows a 'Scrobbling now' chip with the track when a friend is currently playing something", async () => {
    installFakeApis({
      activeAccount: "alice",
      friends: vi.fn().mockResolvedValue([{ username: "bob" }]),
      recentTracksByUser: {
        bob: [{ artist: "Radiohead", track: "Idioteque", nowPlaying: true, loved: false }],
      },
    });

    render(<FriendsPage onNavigateToSettings={vi.fn()} />);

    expect(await screen.findByText("Scrobbling now")).toBeInTheDocument();
    expect(screen.getByText("Idioteque")).toBeInTheDocument();
    expect(screen.getByText(/Radiohead/)).toBeInTheDocument();
  });

  it("shows the last-played track (no chip) when a friend isn't currently playing anything", async () => {
    installFakeApis({
      activeAccount: "alice",
      friends: vi.fn().mockResolvedValue([{ username: "bob" }]),
      recentTracksByUser: {
        bob: [
          {
            artist: "Boards of Canada",
            track: "Roygbiv",
            nowPlaying: false,
            timestamp: 1_700_000_000,
            loved: false,
          },
        ],
      },
    });

    render(<FriendsPage onNavigateToSettings={vi.fn()} />);

    expect(await screen.findByText("Roygbiv")).toBeInTheDocument();
    expect(screen.queryByText("Scrobbling now")).not.toBeInTheDocument();
  });

  describe("subscriber badge", () => {
    it("shows a Last.fm Pro subscriber badge under the avatar for a subscriber", async () => {
      installFakeApis({
        activeAccount: "alice",
        friends: vi.fn().mockResolvedValue([{ username: "bob", isSubscriber: true }]),
      });

      render(<FriendsPage onNavigateToSettings={vi.fn()} />);

      await screen.findByText("bob");
      expect(screen.getByTitle("Last.fm Pro subscriber")).toBeInTheDocument();
    });

    it("does not show a subscriber badge for a non-subscriber", async () => {
      installFakeApis({
        activeAccount: "alice",
        friends: vi.fn().mockResolvedValue([{ username: "bob", isSubscriber: false }]),
      });

      render(<FriendsPage onNavigateToSettings={vi.fn()} />);

      await screen.findByText("bob");
      expect(screen.queryByTitle("Last.fm Pro subscriber")).not.toBeInTheDocument();
    });
  });

  describe("track art", () => {
    it("renders the track's real album art inside its own nested card", async () => {
      installFakeApis({
        activeAccount: "alice",
        friends: vi.fn().mockResolvedValue([{ username: "bob" }]),
        recentTracksByUser: {
          bob: [
            {
              artist: "Radiohead",
              track: "Idioteque",
              nowPlaying: true,
              loved: false,
              imageUrl: "https://lastfm.freetls.fastly.net/i/u/300x300/idioteque.png",
            },
          ],
        },
      });

      render(<FriendsPage onNavigateToSettings={vi.fn()} />);

      const artwork = await screen.findByAltText("Idioteque");
      expect(artwork).toHaveAttribute(
        "src",
        "https://lastfm.freetls.fastly.net/i/u/300x300/idioteque.png",
      );
    });

    it("falls back to the note/play icon when the track has no imageUrl", async () => {
      installFakeApis({
        activeAccount: "alice",
        friends: vi.fn().mockResolvedValue([{ username: "bob" }]),
        recentTracksByUser: {
          bob: [{ artist: "Radiohead", track: "Idioteque", nowPlaying: true, loved: false }],
        },
      });

      render(<FriendsPage onNavigateToSettings={vi.fn()} />);

      await screen.findByText("Idioteque");
      expect(screen.queryByAltText("Idioteque")).not.toBeInTheDocument();
    });
  });

  it("shows no activity line for a friend with no scrobble history", async () => {
    installFakeApis({
      activeAccount: "alice",
      friends: vi.fn().mockResolvedValue([{ username: "bob" }]),
      recentTracksByUser: { bob: [] },
    });

    render(<FriendsPage onNavigateToSettings={vi.fn()} />);

    await screen.findByText("bob");
    expect(screen.queryByText("Scrobbling now")).not.toBeInTheDocument();
  });

  describe("search", () => {
    it("filters the list by username or real name, case-insensitively", async () => {
      installFakeApis({
        activeAccount: "alice",
        friends: vi
          .fn()
          .mockResolvedValue([{ username: "bob", realName: "Bob Smith" }, { username: "carol" }]),
      });

      render(<FriendsPage onNavigateToSettings={vi.fn()} />);
      await screen.findByText("bob");

      fireEvent.change(screen.getByPlaceholderText("Search friends"), {
        target: { value: "SMITH" },
      });

      expect(screen.getByText("bob")).toBeInTheDocument();
      expect(screen.queryByText("carol")).not.toBeInTheDocument();
    });

    it("shows a 'no friends match' message when the search text matches nobody", async () => {
      installFakeApis({
        activeAccount: "alice",
        friends: vi.fn().mockResolvedValue([{ username: "bob" }]),
      });

      render(<FriendsPage onNavigateToSettings={vi.fn()} />);
      await screen.findByText("bob");

      fireEvent.change(screen.getByPlaceholderText("Search friends"), {
        target: { value: "nobody-has-this-name" },
      });

      expect(screen.queryByText("bob")).not.toBeInTheDocument();
      expect(screen.getByText(/no friends match/i)).toBeInTheDocument();
    });
  });

  describe("search icon and clear button", () => {
    it("does not show a clear button when the search field is empty", async () => {
      installFakeApis({
        activeAccount: "alice",
        friends: vi.fn().mockResolvedValue([{ username: "bob" }, { username: "carol" }]),
      });

      render(<FriendsPage onNavigateToSettings={vi.fn()} />);
      await screen.findByText("bob");

      expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument();
    });

    it("shows a clear button once search text is entered, and clicking it resets the search", async () => {
      installFakeApis({
        activeAccount: "alice",
        friends: vi.fn().mockResolvedValue([{ username: "bob" }, { username: "carol" }]),
      });

      render(<FriendsPage onNavigateToSettings={vi.fn()} />);
      await screen.findByText("bob");

      fireEvent.change(screen.getByPlaceholderText("Search friends"), { target: { value: "bob" } });
      expect(screen.queryByText("carol")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /clear search/i }));

      expect(screen.getByPlaceholderText("Search friends")).toHaveValue("");
      expect(await screen.findByText("carol")).toBeInTheDocument();
    });
  });

  describe("sorting", () => {
    it("sorts a friend who is currently 'Scrobbling now' before one who isn't", async () => {
      installFakeApis({
        activeAccount: "alice",
        // Deliberately not-yet-sorted order: carol (not playing) listed before bob
        // (playing), so this only passes if the component actually reorders them.
        friends: vi.fn().mockResolvedValue([{ username: "carol" }, { username: "bob" }]),
        recentTracksByUser: {
          bob: [{ artist: "Radiohead", track: "Idioteque", nowPlaying: true, loved: false }],
          carol: [{ artist: "Aphex Twin", track: "Windowlicker", nowPlaying: false, loved: false }],
        },
      });

      render(<FriendsPage onNavigateToSettings={vi.fn()} />);
      await screen.findByText("Scrobbling now");

      const rowText = screen.getAllByRole("listitem").map((item) => item.textContent);
      const bobIndex = rowText.findIndex((text) => text.includes("bob"));
      const carolIndex = rowText.findIndex((text) => text.includes("carol"));
      expect(bobIndex).toBeGreaterThanOrEqual(0);
      expect(carolIndex).toBeGreaterThanOrEqual(0);
      expect(bobIndex).toBeLessThan(carolIndex);
    });
  });
});

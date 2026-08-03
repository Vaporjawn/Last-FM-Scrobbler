import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../../src/shared/auth-api.js";
import type { LastfmDataApi } from "../../src/shared/lastfm-api.js";
import { ProfilePage } from "../../src/renderer/src/pages/ProfilePage.js";

function installFakeApis(options: {
  activeAccount?: string;
  topArtists?: LastfmDataApi["getTopArtists"];
  topTracks?: LastfmDataApi["getTopTracks"];
  topAlbums?: LastfmDataApi["getTopAlbums"];
  userInfo?: LastfmDataApi["getUserInfo"];
  lovedTracksCount?: LastfmDataApi["getLovedTracksCount"];
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
    getRecentTracks: vi.fn().mockResolvedValue([]),
    getTopArtists: options.topArtists ?? vi.fn().mockResolvedValue([]),
    getTopTracks: options.topTracks ?? vi.fn().mockResolvedValue([]),
    getTopAlbums: options.topAlbums ?? vi.fn().mockResolvedValue([]),
    getFriends: vi.fn().mockResolvedValue([]),
    getUserInfo:
      options.userInfo ??
      vi.fn().mockResolvedValue(options.activeAccount ? { username: options.activeAccount } : undefined),
    getLovedTracksCount: options.lovedTracksCount ?? vi.fn().mockResolvedValue(0),
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

describe("ProfilePage", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "auth");
    Reflect.deleteProperty(window, "lastfm");
  });

  it("prompts to log in when no account is active", async () => {
    installFakeApis({});

    render(<ProfilePage onNavigateToSettings={vi.fn()} />);

    expect(await screen.findByText(/log in.*settings/i)).toBeInTheDocument();
  });

  it("takes the user to Settings when the login prompt's button is clicked", async () => {
    installFakeApis({});
    const onNavigateToSettings = vi.fn();

    render(<ProfilePage onNavigateToSettings={onNavigateToSettings} />);

    fireEvent.click(await screen.findByRole("button", { name: /go to settings/i }));

    expect(onNavigateToSettings).toHaveBeenCalledOnce();
  });

  it("shows the active username and top artists, split into This Week and Overall", async () => {
    installFakeApis({
      activeAccount: "alice",
      // ProfilePage now calls getTopArtists twice — once with period "7day" for the
      // This Week section, once with no period (Last.fm's own "overall" default) —
      // so the fake needs to answer differently per call, the same way the real IPC
      // bridge would for two genuinely different Last.fm API requests.
      topArtists: vi.fn().mockImplementation((_user: string, _limit?: number, period?: string) =>
        Promise.resolve(
          period === "7day"
            ? [{ name: "Men I Trust", playCount: 12 }]
            : [
                { name: "Aphex Twin", playCount: 120 },
                { name: "Boards of Canada", playCount: 87 },
              ],
        ),
      ),
    });

    render(<ProfilePage onNavigateToSettings={vi.fn()} />);

    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText("Top Artists This Week")).toBeInTheDocument();
    expect(await screen.findByText("Men I Trust")).toBeInTheDocument();
    expect(screen.getByText("12 plays")).toBeInTheDocument();
    expect(screen.getByText("Top Artists Overall")).toBeInTheDocument();
    expect(await screen.findByText("Aphex Twin")).toBeInTheDocument();
    expect(screen.getByText("120 plays")).toBeInTheDocument();
  });

  it("switches both sections to the tile grid via the view dropdown", async () => {
    installFakeApis({
      activeAccount: "alice",
      topArtists: vi.fn().mockResolvedValue([{ name: "Aphex Twin", playCount: 120 }]),
    });

    render(<ProfilePage onNavigateToSettings={vi.fn()} />);
    // The list view's rank number ("1") only exists in TopArtistListItem, not
    // TopArtistTile — a real, unambiguous signal of which one actually rendered,
    // unlike the artist name/play-count text, which reads identically in both.
    await screen.findAllByText("Aphex Twin");
    expect(screen.getAllByText("1")).toHaveLength(2);

    fireEvent.mouseDown(screen.getByLabelText("Top Artists view"));
    fireEvent.click(await screen.findByRole("option", { name: "Tiles" }));

    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.getAllByText("Aphex Twin")).toHaveLength(2);
  });

  it("renders the real Last.fm avatar photo when the account has one", async () => {
    installFakeApis({
      activeAccount: "alice",
      userInfo: vi.fn().mockResolvedValue({
        username: "alice",
        avatarUrl: "https://lastfm.freetls.fastly.net/i/u/300x300/abc123.png",
      }),
    });

    render(<ProfilePage onNavigateToSettings={vi.fn()} />);

    const avatarImg = await screen.findByRole("img", { name: "alice" });
    expect(avatarImg).toHaveAttribute(
      "src",
      "https://lastfm.freetls.fastly.net/i/u/300x300/abc123.png",
    );
  });

  it("falls back to a letter avatar when the account has no photo set", async () => {
    installFakeApis({
      activeAccount: "alice",
      userInfo: vi.fn().mockResolvedValue({ username: "alice" }),
    });

    render(<ProfilePage onNavigateToSettings={vi.fn()} />);

    // Username renders as soon as useAuth resolves, before the avatar fetch settles —
    // wait for that first so the fallback-letter assertion below isn't racing it.
    await screen.findByText("alice");
    expect(screen.queryByRole("img", { name: "alice" })).not.toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("falls back to a letter avatar when the user-info fetch fails", async () => {
    installFakeApis({
      activeAccount: "alice",
      userInfo: vi.fn().mockRejectedValue(new Error("network error")),
    });

    render(<ProfilePage onNavigateToSettings={vi.fn()} />);

    await screen.findByText("alice");
    expect(screen.queryByRole("img", { name: "alice" })).not.toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  describe("account stats", () => {
    it("shows total scrobbles, loved tracks, and a member-since date when Last.fm has all three on file", async () => {
      installFakeApis({
        activeAccount: "alice",
        userInfo: vi.fn().mockResolvedValue({
          username: "alice",
          totalScrobbles: 151_481,
          // 1037793040 unix seconds = November 20, 2002
          registeredAt: 1_037_793_040,
        }),
        lovedTracksCount: vi.fn().mockResolvedValue(1_381),
      });

      render(<ProfilePage onNavigateToSettings={vi.fn()} />);

      expect(await screen.findByText("151,481")).toBeInTheDocument();
      expect(screen.getByText("Scrobbles")).toBeInTheDocument();
      expect(screen.getByText("1,381")).toBeInTheDocument();
      expect(screen.getByText("Loved tracks")).toBeInTheDocument();
      expect(screen.getByText("Member since November 2002")).toBeInTheDocument();
    });

    it("shows only whichever stats Last.fm actually has on file", async () => {
      installFakeApis({
        activeAccount: "alice",
        userInfo: vi.fn().mockResolvedValue({ username: "alice", totalScrobbles: 42 }),
        lovedTracksCount: vi.fn().mockResolvedValue(undefined),
      });

      render(<ProfilePage onNavigateToSettings={vi.fn()} />);

      expect(await screen.findByText("42")).toBeInTheDocument();
      expect(screen.queryByText("Loved tracks")).not.toBeInTheDocument();
      expect(screen.queryByText(/member since/i)).not.toBeInTheDocument();
    });

    it("shows neither stat, without a broken layout, when Last.fm has neither on file", async () => {
      installFakeApis({
        activeAccount: "alice",
        userInfo: vi.fn().mockResolvedValue({ username: "alice" }),
        lovedTracksCount: vi.fn().mockResolvedValue(undefined),
      });

      render(<ProfilePage onNavigateToSettings={vi.fn()} />);

      await screen.findByText("alice");
      expect(screen.queryByText("Scrobbles")).not.toBeInTheDocument();
      expect(screen.queryByText("Loved tracks")).not.toBeInTheDocument();
      expect(screen.queryByText(/member since/i)).not.toBeInTheDocument();
    });
  });

  describe("real name, location, and subscriber badge", () => {
    it("shows real name and location on the account card when Last.fm has both on file", async () => {
      installFakeApis({
        activeAccount: "alice",
        userInfo: vi.fn().mockResolvedValue({
          username: "alice",
          realName: "Victor Williams",
          location: "United States",
        }),
      });

      render(<ProfilePage onNavigateToSettings={vi.fn()} />);

      expect(await screen.findByText("Victor Williams · United States")).toBeInTheDocument();
      expect(screen.queryByText("Last.fm account")).not.toBeInTheDocument();
    });

    it("falls back to 'Last.fm account' when the profile has neither a real name nor a location", async () => {
      installFakeApis({
        activeAccount: "alice",
        userInfo: vi.fn().mockResolvedValue({ username: "alice" }),
      });

      render(<ProfilePage onNavigateToSettings={vi.fn()} />);

      expect(await screen.findByText("Last.fm account")).toBeInTheDocument();
    });

    it("shows a subscriber badge on the avatar for a Last.fm Pro subscriber", async () => {
      installFakeApis({
        activeAccount: "alice",
        userInfo: vi.fn().mockResolvedValue({ username: "alice", isSubscriber: true }),
      });

      render(<ProfilePage onNavigateToSettings={vi.fn()} />);

      expect(await screen.findByTitle("Last.fm Pro subscriber")).toBeInTheDocument();
    });

    it("doesn't show a subscriber badge for a non-subscriber account", async () => {
      installFakeApis({
        activeAccount: "alice",
        userInfo: vi.fn().mockResolvedValue({ username: "alice", isSubscriber: false }),
      });

      render(<ProfilePage onNavigateToSettings={vi.fn()} />);

      await screen.findByText("alice");
      expect(screen.queryByTitle("Last.fm Pro subscriber")).not.toBeInTheDocument();
    });
  });

  describe("Top Tracks and Top Albums", () => {
    it("shows top tracks and top albums, each requested for the same target username", async () => {
      const getTopTracks = vi
        .fn()
        .mockResolvedValue([{ name: "Windowlicker", artist: "Aphex Twin", playCount: 42 }]);
      const getTopAlbums = vi.fn().mockResolvedValue([
        {
          name: "In Rainbows",
          artist: "Radiohead",
          playCount: 30,
          imageUrl: "https://lastfm.freetls.fastly.net/i/u/300x300/inrainbows.jpg",
        },
      ]);
      installFakeApis({ activeAccount: "alice", topTracks: getTopTracks, topAlbums: getTopAlbums });

      render(<ProfilePage onNavigateToSettings={vi.fn()} />);

      // `activeAccount` (from useAuth()) resolves asynchronously — the first
      // synchronous render still shows the login gate, so wait for real content
      // before making any synchronous assertions.
      expect(await screen.findByText("Windowlicker")).toBeInTheDocument();
      expect(screen.getByText("Top Tracks")).toBeInTheDocument();
      expect(screen.getByText("Aphex Twin — 42 plays")).toBeInTheDocument();

      expect(await screen.findByText("In Rainbows")).toBeInTheDocument();
      expect(screen.getByText("Top Albums")).toBeInTheDocument();
      expect(screen.getByText("Radiohead — 30 plays")).toBeInTheDocument();

      expect(getTopTracks).toHaveBeenCalledWith("alice", expect.anything(), undefined);
      expect(getTopAlbums).toHaveBeenCalledWith("alice", expect.anything(), undefined);
    });

    it("shows empty-state messages for Top Tracks and Top Albums when Last.fm has neither", async () => {
      installFakeApis({ activeAccount: "alice" });

      render(<ProfilePage onNavigateToSettings={vi.fn()} />);

      await screen.findByText("alice");
      const emptyMessages = await screen.findAllByText("No scrobbles yet.");
      // Top Artists Overall, Top Tracks, and Top Albums all share this exact wording —
      // three, not one, confirms Top Tracks/Albums actually rendered their own empty
      // states rather than silently not rendering at all.
      expect(emptyMessages.length).toBeGreaterThanOrEqual(3);
    });

    it("switches the Top Albums grid to tiles independently of the Top Artists view toggle", async () => {
      installFakeApis({
        activeAccount: "alice",
        topArtists: vi.fn().mockResolvedValue([{ name: "Aphex Twin", playCount: 120 }]),
        topAlbums: vi
          .fn()
          .mockResolvedValue([{ name: "In Rainbows", artist: "Radiohead", playCount: 30 }]),
      });

      render(<ProfilePage onNavigateToSettings={vi.fn()} />);
      await screen.findAllByText("Aphex Twin");
      await screen.findByText("In Rainbows");

      // Both Top Artists sections (This Week + Overall) and Top Albums start in list
      // mode — rank "1" appears three times (one per section).
      const ranksBeforeSwitch = screen.getAllByText("1");
      expect(ranksBeforeSwitch).toHaveLength(3);

      fireEvent.mouseDown(screen.getByLabelText("Top Albums view"));
      fireEvent.click(await screen.findByRole("option", { name: "Tiles" }));

      // Top Albums switched to tiles (its own rank number disappears), but Top
      // Artists' own, separate Select is untouched — its two sections still show
      // theirs, so exactly one "1" (Top Albums') should be gone, not all three.
      expect(screen.getAllByText("1")).toHaveLength(2);
      expect(screen.getAllByText("Aphex Twin")).toHaveLength(2);
    });
  });

  describe("default behavior when username is omitted (regression)", () => {
    it("shows the logged-in account's own profile, titled 'Profile', with no back button", async () => {
      installFakeApis({
        activeAccount: "alice",
        userInfo: vi.fn().mockResolvedValue({ username: "alice" }),
        // Period-aware, same as the "This Week"/"Overall" test above — a single
        // fixed list for every call would render "Aphex Twin" twice (once per
        // section) and break the exact-text assertion below.
        topArtists: vi.fn().mockImplementation((_user: string, _limit?: number, period?: string) =>
          Promise.resolve(period === "7day" ? [{ name: "Aphex Twin", playCount: 120 }] : []),
        ),
      });

      render(<ProfilePage onNavigateToSettings={vi.fn()} />);

      expect(await screen.findByText("alice")).toBeInTheDocument();
      expect(screen.getByText("Profile")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /back to/i })).not.toBeInTheDocument();
      await screen.findByText("Aphex Twin");
    });
  });

  describe("viewing a friend's profile", () => {
    it("shows the given username's data instead of the logged-in account's own", async () => {
      const getUserInfo = vi
        .fn()
        .mockImplementation((user: string) => Promise.resolve({ username: user }));
      const getTopArtists = vi
        .fn()
        .mockImplementation((user: string, _limit?: number, period?: string) =>
          Promise.resolve(
            user === "bob" && period === undefined
              ? [{ name: "Boards of Canada", playCount: 42 }]
              : [],
          ),
        );
      installFakeApis({ activeAccount: "alice", userInfo: getUserInfo, topArtists: getTopArtists });

      render(<ProfilePage onNavigateToSettings={vi.fn()} username="bob" />);

      // Page title reflects whose profile this is once it's not the logged-in
      // account's own — "bob", not the generic "Profile" heading — so "bob" appears
      // twice: once as the title, once in the account card.
      const bobMatches = await screen.findAllByText("bob");
      expect(bobMatches).toHaveLength(2);
      expect(screen.queryByText("alice")).not.toBeInTheDocument();
      expect(await screen.findByText("Boards of Canada")).toBeInTheDocument();
      expect(getUserInfo).toHaveBeenCalledWith("bob");
      expect(getTopArtists).toHaveBeenCalledWith("bob", expect.anything(), "7day");
    });

    it("does not require a logged-in account to view a friend's profile", async () => {
      installFakeApis({
        userInfo: vi.fn().mockResolvedValue({ username: "bob" }),
        topArtists: vi.fn().mockResolvedValue([]),
      });

      render(<ProfilePage onNavigateToSettings={vi.fn()} username="bob" />);

      expect(await screen.findAllByText("bob")).toHaveLength(2);
      expect(screen.queryByText(/log in.*settings/i)).not.toBeInTheDocument();
    });
  });

  describe("back navigation", () => {
    it("shows a 'Back to {backLabel}' button when onBack is given, and calls onBack when clicked", async () => {
      installFakeApis({
        activeAccount: "alice",
        userInfo: vi.fn().mockResolvedValue({ username: "bob" }),
        topArtists: vi.fn().mockResolvedValue([]),
      });
      const onBack = vi.fn();

      render(
        <ProfilePage
          onNavigateToSettings={vi.fn()}
          username="bob"
          backLabel="Friends"
          onBack={onBack}
        />,
      );

      const backButton = await screen.findByRole("button", { name: /back to friends/i });
      fireEvent.click(backButton);

      expect(onBack).toHaveBeenCalledOnce();
    });

    it("still shows the back button on the login-gate screen when onBack is given but there's nobody to show", async () => {
      installFakeApis({});
      const onBack = vi.fn();

      render(<ProfilePage onNavigateToSettings={vi.fn()} backLabel="Friends" onBack={onBack} />);

      expect(await screen.findByRole("button", { name: /back to friends/i })).toBeInTheDocument();
      expect(screen.getByText(/log in.*settings/i)).toBeInTheDocument();
    });
  });
});

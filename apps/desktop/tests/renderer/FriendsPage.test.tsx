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

    render(<FriendsPage onNavigateToPreferences={vi.fn()} />);

    expect(await screen.findByText(/log in.*preferences/i)).toBeInTheDocument();
  });

  it("takes the user to Preferences when the login prompt's button is clicked", async () => {
    installFakeApis({});
    const onNavigateToPreferences = vi.fn();

    render(<FriendsPage onNavigateToPreferences={onNavigateToPreferences} />);

    fireEvent.click(await screen.findByRole("button", { name: /go to preferences/i }));

    expect(onNavigateToPreferences).toHaveBeenCalledOnce();
  });

  it("shows friends with real names when available", async () => {
    installFakeApis({
      activeAccount: "alice",
      friends: vi
        .fn()
        .mockResolvedValue([{ username: "bob", realName: "Bob Smith" }, { username: "carol" }]),
    });

    render(<FriendsPage onNavigateToPreferences={vi.fn()} />);

    expect(await screen.findByText("bob")).toBeInTheDocument();
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    expect(screen.getByText("carol")).toBeInTheDocument();
  });

  it("shows an empty-state message when there are no friends", async () => {
    installFakeApis({ activeAccount: "alice", friends: vi.fn().mockResolvedValue([]) });

    render(<FriendsPage onNavigateToPreferences={vi.fn()} />);

    expect(await screen.findByText(/no friends/i)).toBeInTheDocument();
  });

  it("renders each friend's real avatar photo when Last.fm has one on file", async () => {
    installFakeApis({
      activeAccount: "alice",
      friends: vi.fn().mockResolvedValue([
        { username: "bob", avatarUrl: "https://lastfm.freetls.fastly.net/i/u/300x300/bob.png" },
      ]),
    });

    render(<FriendsPage onNavigateToPreferences={vi.fn()} />);

    const avatarImg = await screen.findByRole("img", { name: "bob" });
    expect(avatarImg).toHaveAttribute("src", "https://lastfm.freetls.fastly.net/i/u/300x300/bob.png");
  });

  it("falls back to a letter avatar for a friend with no photo set", async () => {
    installFakeApis({
      activeAccount: "alice",
      friends: vi.fn().mockResolvedValue([{ username: "bob" }]),
    });

    render(<FriendsPage onNavigateToPreferences={vi.fn()} />);

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

    render(<FriendsPage onNavigateToPreferences={vi.fn()} />);

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

    render(<FriendsPage onNavigateToPreferences={vi.fn()} />);

    expect(await screen.findByText("Roygbiv")).toBeInTheDocument();
    expect(screen.queryByText("Scrobbling now")).not.toBeInTheDocument();
  });

  it("shows no activity line for a friend with no scrobble history", async () => {
    installFakeApis({
      activeAccount: "alice",
      friends: vi.fn().mockResolvedValue([{ username: "bob" }]),
      recentTracksByUser: { bob: [] },
    });

    render(<FriendsPage onNavigateToPreferences={vi.fn()} />);

    await screen.findByText("bob");
    expect(screen.queryByText("Scrobbling now")).not.toBeInTheDocument();
  });
});

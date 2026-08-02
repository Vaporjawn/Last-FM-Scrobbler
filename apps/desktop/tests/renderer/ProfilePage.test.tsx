import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../../src/shared/auth-api.js";
import type { LastfmDataApi } from "../../src/shared/lastfm-api.js";
import { ProfilePage } from "../../src/renderer/src/pages/ProfilePage.js";

function installFakeApis(options: {
  activeAccount?: string;
  topArtists?: LastfmDataApi["getTopArtists"];
  userInfo?: LastfmDataApi["getUserInfo"];
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
    getFriends: vi.fn().mockResolvedValue([]),
    getUserInfo:
      options.userInfo ??
      vi.fn().mockResolvedValue(options.activeAccount ? { username: options.activeAccount } : undefined),
    getArtistInfo: vi.fn(),
    getSimilarArtists: vi.fn(),
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

    render(<ProfilePage onNavigateToPreferences={vi.fn()} />);

    expect(await screen.findByText(/log in.*preferences/i)).toBeInTheDocument();
  });

  it("takes the user to Preferences when the login prompt's button is clicked", async () => {
    installFakeApis({});
    const onNavigateToPreferences = vi.fn();

    render(<ProfilePage onNavigateToPreferences={onNavigateToPreferences} />);

    fireEvent.click(await screen.findByRole("button", { name: /go to preferences/i }));

    expect(onNavigateToPreferences).toHaveBeenCalledOnce();
  });

  it("shows the active username and top artists", async () => {
    installFakeApis({
      activeAccount: "alice",
      topArtists: vi.fn().mockResolvedValue([
        { name: "Aphex Twin", playCount: 120 },
        { name: "Boards of Canada", playCount: 87 },
      ]),
    });

    render(<ProfilePage onNavigateToPreferences={vi.fn()} />);

    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(await screen.findByText("Aphex Twin")).toBeInTheDocument();
    expect(screen.getByText("120 plays")).toBeInTheDocument();
  });

  it("renders the real Last.fm avatar photo when the account has one", async () => {
    installFakeApis({
      activeAccount: "alice",
      userInfo: vi.fn().mockResolvedValue({
        username: "alice",
        avatarUrl: "https://lastfm.freetls.fastly.net/i/u/300x300/abc123.png",
      }),
    });

    render(<ProfilePage onNavigateToPreferences={vi.fn()} />);

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

    render(<ProfilePage onNavigateToPreferences={vi.fn()} />);

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

    render(<ProfilePage onNavigateToPreferences={vi.fn()} />);

    await screen.findByText("alice");
    expect(screen.queryByRole("img", { name: "alice" })).not.toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});

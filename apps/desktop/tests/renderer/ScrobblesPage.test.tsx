import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../../src/shared/auth-api.js";
import type { LastfmDataApi } from "../../src/shared/lastfm-api.js";
import { ScrobblesPage } from "../../src/renderer/src/pages/ScrobblesPage.js";

function installFakeApis(options: {
  activeAccount?: string;
  recentTracks?: LastfmDataApi["getRecentTracks"];
}): void {
  const auth: AuthApi = {
    isConfigured: vi.fn().mockResolvedValue(true),
    login: vi.fn(),
    logout: vi.fn(),
    listAccounts: vi.fn().mockResolvedValue(options.activeAccount ? [options.activeAccount] : []),
    getActiveAccount: vi.fn().mockResolvedValue(options.activeAccount),
    setActiveAccount: vi.fn(),
  };
  const lastfm: LastfmDataApi = {
    getRecentTracks: options.recentTracks ?? vi.fn().mockResolvedValue([]),
    getTopArtists: vi.fn().mockResolvedValue([]),
    getFriends: vi.fn().mockResolvedValue([]),
  };
  Object.defineProperty(window, "auth", { value: auth, configurable: true });
  Object.defineProperty(window, "lastfm", { value: lastfm, configurable: true });
}

describe("ScrobblesPage", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "auth");
    Reflect.deleteProperty(window, "lastfm");
  });

  it("prompts to log in when no account is active", async () => {
    installFakeApis({});

    render(<ScrobblesPage />);

    expect(await screen.findByText(/log in.*preferences/i)).toBeInTheDocument();
  });

  it("shows recent tracks for the active account", async () => {
    installFakeApis({
      activeAccount: "alice",
      recentTracks: vi.fn().mockResolvedValue([
        { artist: "Aphex Twin", track: "Windowlicker", nowPlaying: false, timestamp: 1_700_000_000 },
        { artist: "Boards of Canada", track: "Roygbiv", nowPlaying: true },
      ]),
    });

    render(<ScrobblesPage />);

    expect(await screen.findByText("Windowlicker")).toBeInTheDocument();
    expect(screen.getByText("Aphex Twin")).toBeInTheDocument();
    expect(screen.getByText("Roygbiv")).toBeInTheDocument();
    expect(screen.getByText(/now playing/i)).toBeInTheDocument();
  });

  it("shows an empty-state message when there are no recent tracks", async () => {
    installFakeApis({ activeAccount: "alice", recentTracks: vi.fn().mockResolvedValue([]) });

    render(<ScrobblesPage />);

    expect(await screen.findByText(/no scrobbles yet/i)).toBeInTheDocument();
  });
});

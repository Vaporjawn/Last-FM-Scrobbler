import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../../src/shared/auth-api.js";
import type { LastfmDataApi } from "../../src/shared/lastfm-api.js";
import { ProfilePage } from "../../src/renderer/src/pages/ProfilePage.js";

function installFakeApis(options: {
  activeAccount?: string;
  topArtists?: LastfmDataApi["getTopArtists"];
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
    getRecentTracks: vi.fn().mockResolvedValue([]),
    getTopArtists: options.topArtists ?? vi.fn().mockResolvedValue([]),
    getFriends: vi.fn().mockResolvedValue([]),
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

    render(<ProfilePage />);

    expect(await screen.findByText(/log in.*preferences/i)).toBeInTheDocument();
  });

  it("shows the active username and top artists", async () => {
    installFakeApis({
      activeAccount: "alice",
      topArtists: vi.fn().mockResolvedValue([
        { name: "Aphex Twin", playCount: 120 },
        { name: "Boards of Canada", playCount: 87 },
      ]),
    });

    render(<ProfilePage />);

    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(await screen.findByText("Aphex Twin")).toBeInTheDocument();
    expect(screen.getByText("120 plays")).toBeInTheDocument();
  });
});

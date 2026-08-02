import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../../src/shared/auth-api.js";
import type { LastfmDataApi } from "../../src/shared/lastfm-api.js";
import { FriendsPage } from "../../src/renderer/src/pages/FriendsPage.js";

function installFakeApis(options: {
  activeAccount?: string;
  friends?: LastfmDataApi["getFriends"];
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
    getTopArtists: vi.fn().mockResolvedValue([]),
    getFriends: options.friends ?? vi.fn().mockResolvedValue([]),
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

    render(<FriendsPage />);

    expect(await screen.findByText(/log in.*preferences/i)).toBeInTheDocument();
  });

  it("shows friends with real names when available", async () => {
    installFakeApis({
      activeAccount: "alice",
      friends: vi.fn().mockResolvedValue([
        { username: "bob", realName: "Bob Smith" },
        { username: "carol" },
      ]),
    });

    render(<FriendsPage />);

    expect(await screen.findByText("bob")).toBeInTheDocument();
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    expect(screen.getByText("carol")).toBeInTheDocument();
  });

  it("shows an empty-state message when there are no friends", async () => {
    installFakeApis({ activeAccount: "alice", friends: vi.fn().mockResolvedValue([]) });

    render(<FriendsPage />);

    expect(await screen.findByText(/no friends/i)).toBeInTheDocument();
  });
});

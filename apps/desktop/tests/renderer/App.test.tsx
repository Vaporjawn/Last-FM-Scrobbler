import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecentTrack } from "@lastfm-scrobbler/core";

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/renderer/src/hooks/use-auth.js", () => ({ useAuth: useAuthMock }));

interface StubPageProps {
  readonly onNavigateToSettings?: () => void;
  readonly onNavigateToProfile?: () => void;
  readonly onSelectScrobble?: (track: RecentTrack) => void;
  readonly onSelectFriend?: (username: string) => void;
}

function stubPage(name: string) {
  return function StubPage(props: StubPageProps) {
    return (
      <section aria-label={name}>
        <button type="button" onClick={props.onNavigateToSettings}>
          {name} to settings
        </button>
        <button type="button" onClick={props.onNavigateToProfile}>
          {name} to profile
        </button>
        <button
          type="button"
          onClick={() =>
            props.onSelectScrobble?.({ artist: "A", track: "T", nowPlaying: false, loved: false })
          }
        >
          {name} select scrobble
        </button>
        <button type="button" onClick={() => props.onSelectFriend?.("friend")}>
          {name} select friend
        </button>
      </section>
    );
  };
}

vi.mock("../../src/renderer/src/pages/NowPlayingPage.js", () => ({
  NowPlayingPage: stubPage("now-playing page"),
}));
vi.mock("../../src/renderer/src/pages/ScrobblesPage.js", () => ({
  ScrobblesPage: stubPage("scrobbles page"),
}));
vi.mock("../../src/renderer/src/pages/FriendsPage.js", () => ({
  FriendsPage: stubPage("friends page"),
}));
vi.mock("../../src/renderer/src/pages/SettingsPage.js", () => ({
  SettingsPage: stubPage("settings page"),
}));
vi.mock("../../src/renderer/src/pages/ProfilePage.js", () => ({
  ProfilePage: (props: {
    username?: string;
    backLabel?: string;
    onBack?: () => void;
    onNavigateToSettings?: () => void;
  }) => (
    <section aria-label="profile page">
      <span>{props.username ?? "own profile"}</span>
      <button type="button" onClick={props.onNavigateToSettings}>
        profile to settings
      </button>
      {props.onBack ? (
        <button type="button" onClick={props.onBack}>
          Back to {props.backLabel}
        </button>
      ) : null}
    </section>
  ),
}));
vi.mock("../../src/renderer/src/pages/ScrobbleDetailPage.js", () => ({
  ScrobbleDetailPage: (props: {
    backLabel: string;
    activeAccount?: string;
    onBack: () => void;
  }) => (
    <section aria-label="scrobble detail">
      <span>account: {props.activeAccount ?? "none"}</span>
      <button type="button" onClick={props.onBack}>
        Back to {props.backLabel}
      </button>
    </section>
  ),
}));
vi.mock("../../src/renderer/src/components/NavigationSidebar.js", () => ({
  NavigationSidebar: (props: {
    onSelectView: (view: "scrobbles" | "friends" | "profile" | "settings") => void;
    onReportBug: () => void;
  }) => (
    <nav>
      <button
        type="button"
        onClick={() => {
          props.onSelectView("scrobbles");
        }}
      >
        go scrobbles
      </button>
      <button
        type="button"
        onClick={() => {
          props.onSelectView("friends");
        }}
      >
        go friends
      </button>
      <button type="button" onClick={props.onReportBug}>
        report bug
      </button>
    </nav>
  ),
}));
vi.mock("../../src/renderer/src/components/BugReportDialog.js", () => ({
  BugReportDialog: (props: { open: boolean; onClose: () => void }) =>
    props.open ? (
      <div role="dialog">
        bug report
        <button type="button" onClick={props.onClose}>
          close bug report
        </button>
      </div>
    ) : null,
}));

import { App } from "../../src/renderer/src/App.js";
import { SettingsContext } from "../../src/renderer/src/contexts/settings-context.js";
import { DEFAULT_APP_SETTINGS } from "../../src/shared/settings-api.js";
import { ok } from "../../src/renderer/src/hooks/ok.js";

describe("App", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ activeAccount: "alice" });
  });

  it("starts on the now-playing page and follows the sidebar", () => {
    render(<App />);
    expect(screen.getByRole("region", { name: "now-playing page" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("go scrobbles"));
    expect(screen.getByRole("region", { name: "scrobbles page" })).toBeInTheDocument();
  });

  it("lets a page jump to Settings or Profile", () => {
    render(<App />);

    fireEvent.click(screen.getByText("now-playing page to settings"));
    expect(screen.getByRole("region", { name: "settings page" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("settings page to profile"));
    expect(screen.getByRole("region", { name: "profile page" })).toBeInTheDocument();
  });

  it("opens a scrobble's detail page with a context-aware way back, and clears it on navigation", () => {
    render(<App />);
    fireEvent.click(screen.getByText("go scrobbles"));

    fireEvent.click(screen.getByText("scrobbles page select scrobble"));
    expect(screen.getByText("account: alice")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Back to Scrobbles"));
    expect(screen.getByRole("region", { name: "scrobbles page" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("scrobbles page select scrobble"));
    fireEvent.click(screen.getByText("go friends"));
    expect(screen.getByRole("region", { name: "friends page" })).toBeInTheDocument();
  });

  it("opens a friend's profile with a way back, and lets it jump to Settings", () => {
    render(<App />);
    fireEvent.click(screen.getByText("go friends"));

    fireEvent.click(screen.getByText("friends page select friend"));
    expect(screen.getByText("friend")).toBeInTheDocument();

    // The friend's profile stays up, but the underlying view has switched to Settings,
    // which is where going back lands.
    fireEvent.click(screen.getByText("profile to settings"));
    fireEvent.click(screen.getByText("Back to Settings"));
    expect(screen.getByRole("region", { name: "settings page" })).toBeInTheDocument();
  });

  it("returns from a friend's profile to the list it was opened from", () => {
    render(<App />);
    fireEvent.click(screen.getByText("go friends"));
    fireEvent.click(screen.getByText("friends page select friend"));

    fireEvent.click(screen.getByText("Back to Friends"));

    expect(screen.getByRole("region", { name: "friends page" })).toBeInTheDocument();
  });

  it("opens and closes the bug report dialog", () => {
    render(<App />);

    fireEvent.click(screen.getByText("report bug"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByText("close bug report"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tells the browser which colour scheme the chosen theme uses", () => {
    render(
      <SettingsContext.Provider
        value={{
          settings: { ...DEFAULT_APP_SETTINGS, themeMode: "light" },
          loading: false,
          error: undefined,
          updateSettings: vi.fn().mockResolvedValue(ok()),
          resetSettings: vi.fn().mockResolvedValue(ok()),
        }}
      >
        <App />
      </SettingsContext.Provider>,
    );

    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});

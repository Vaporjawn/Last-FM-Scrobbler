import { useEffect, useMemo, useState, type JSX } from "react";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import type { RecentTrack } from "@lastfm-scrobbler/core";
import { BugReportDialog } from "./components/BugReportDialog.js";
import { getViewLabel } from "./components/get-view-label.js";
import type { ViewId } from "./components/nav-items.js";
import { NavigationSidebar } from "./components/NavigationSidebar.js";
import { SnackbarProvider } from "./contexts/SnackbarProvider.js";
import { useSettings } from "./contexts/settings-context.js";
import { useAuth } from "./hooks/use-auth.js";
import { FriendsPage } from "./pages/FriendsPage.js";
import { NowPlayingPage } from "./pages/NowPlayingPage.js";
import type { PageProps } from "./pages/page-props.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { ProfilePage } from "./pages/ProfilePage.js";
import { ScrobbleDetailPage } from "./pages/ScrobbleDetailPage.js";
import { ScrobblesPage } from "./pages/ScrobblesPage.js";
import { createAppTheme } from "./theme/index.js";

// A component that ignores some or all of `PageProps` (e.g. NowPlayingPage, which
// never navigates anywhere) is still structurally assignable to this map's value type,
// so every entry can be listed uniformly here regardless of which props it actually
// uses.
const PAGES: Record<ViewId, (props: PageProps) => JSX.Element> = {
  "now-playing": NowPlayingPage,
  scrobbles: ScrobblesPage,
  profile: ProfilePage,
  friends: FriendsPage,
  settings: SettingsPage,
};

/**
 * The renderer's composition root: theme/snackbar providers, the persistent sidebar,
 * and the single-page-at-a-time view switcher (see `PAGES` above and the drill-down
 * detail views handled inline below — `ScrobbleDetailPage` and the friend-scoped
 * `ProfilePage` — neither of which is a `ViewId` destination of its own).
 */
export function App(): JSX.Element {
  const [activeView, setActiveView] = useState<ViewId>("now-playing");
  const [bugReportOpen, setBugReportOpen] = useState(false);
  // Deliberately separate from `activeView`/`PAGES` above rather than folded into the
  // `ViewId` union: a scrobble's detail view isn't a sidebar destination, it's a
  // drill-down reached from more than one view's list now (ScrobblesPage's rows,
  // FriendsPage's activity cards — see `PageProps.onSelectScrobble`) that always
  // returns to whichever view was active when it opened, not always Scrobbles — see
  // `ScrobbleDetailPage`'s docstring and its `backLabel` prop below.
  const [selectedTrack, setSelectedTrack] = useState<RecentTrack | undefined>(undefined);
  // Same drill-down pattern as `selectedTrack` above, for a friend's own row on
  // FriendsPage (see `PageProps.onSelectFriend`) — reuses `ProfilePage` itself rather
  // than a second page, passing the friend's username through as its `username` prop
  // and a `backLabel`/`onBack` pair so it renders with a "Back to Friends" button
  // instead of as the sidebar's own plain "Profile" destination.
  const [selectedFriendUsername, setSelectedFriendUsername] = useState<string | undefined>(
    undefined,
  );
  const { activeAccount } = useAuth();
  const { settings } = useSettings();
  const ActivePage = PAGES[activeView];
  // Rebuilt only when the mode actually changes, not on every unrelated re-render —
  // createAppTheme() constructs a brand-new theme object each call, and MUI's
  // ThemeProvider/emotion cache re-derive every styled component's CSS whenever the
  // theme *reference* changes, regardless of whether its contents actually differ.
  const theme = useMemo(() => createAppTheme(settings.themeMode), [settings.themeMode]);

  // Keeps native, non-MUI-controlled chrome (scrollbar theming, default form-control
  // appearance) in sync with the user's chosen mode — MUI's CssBaseline already
  // updates everything it renders itself via the theme prop above; this is only for
  // what's outside that (see index.html's static `color-scheme` meta, which only
  // covers the pre-mount loading state before `settings.themeMode` is even known).
  useEffect(() => {
    document.documentElement.style.colorScheme = settings.themeMode;
  }, [settings.themeMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
        <Box sx={{ display: "flex", height: "100vh" }}>
          <NavigationSidebar
            activeView={activeView}
            onSelectView={(view) => {
              // A sidebar click always wins over an open detail view — otherwise
              // clicking, say, "Profile" while looking at a scrobble's detail would
              // silently do nothing, trapping the user there.
              setSelectedTrack(undefined);
              setSelectedFriendUsername(undefined);
              setActiveView(view);
            }}
            onReportBug={() => {
              setBugReportOpen(true);
            }}
          />
          {/* `minWidth: 0` is the fix, not `overflow: "auto"` alone — a flex item's
              default `min-width` is `auto`, meaning it refuses to shrink below its
              *content's* intrinsic width. Without this, any unshrinkable element
              anywhere in the entire active page's tree (a long unwrapped string, a
              fixed-width row, a CSS Grid track that won't shrink below its content —
              see the fixes elsewhere in this pass) sets this whole box's effective
              minimum width, which then forces it — and the whole app, since this is
              the only element standing between the fixed-width sidebar and the
              window's own edge — wider than the window itself, rather than that one
              element failing in isolation. `overflow: "auto"` only governs how *this*
              box's own children overflow once its size is already decided; it does
              nothing to let the box itself shrink. */}
          <Box component="main" sx={{ flexGrow: 1, minWidth: 0, overflow: "auto" }}>
            {selectedTrack ? (
              <ScrobbleDetailPage
                track={selectedTrack}
                activeAccount={activeAccount}
                backLabel={getViewLabel(activeView)}
                onBack={() => {
                  setSelectedTrack(undefined);
                }}
              />
            ) : selectedFriendUsername ? (
              <ProfilePage
                username={selectedFriendUsername}
                backLabel={getViewLabel(activeView)}
                onBack={() => {
                  setSelectedFriendUsername(undefined);
                }}
                onNavigateToSettings={() => {
                  setActiveView("settings");
                }}
              />
            ) : (
              <ActivePage
                onNavigateToSettings={() => {
                  setActiveView("settings");
                }}
                onNavigateToProfile={() => {
                  setActiveView("profile");
                }}
                onSelectScrobble={setSelectedTrack}
                onSelectFriend={setSelectedFriendUsername}
              />
            )}
          </Box>
        </Box>
        <BugReportDialog
          open={bugReportOpen}
          onClose={() => {
            setBugReportOpen(false);
          }}
        />
      </SnackbarProvider>
    </ThemeProvider>
  );
}

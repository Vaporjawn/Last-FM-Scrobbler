import { useState, type JSX } from "react";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { BugReportDialog } from "./components/BugReportDialog.js";
import { NavigationSidebar, type ViewId } from "./components/NavigationSidebar.js";
import { SnackbarProvider } from "./contexts/SnackbarProvider.js";
import { FriendsPage } from "./pages/FriendsPage.js";
import { NowPlayingPage } from "./pages/NowPlayingPage.js";
import type { PageProps } from "./pages/page-props.js";
import { PreferencesPage } from "./pages/PreferencesPage.js";
import { ProfilePage } from "./pages/ProfilePage.js";
import { ScrobblesPage } from "./pages/ScrobblesPage.js";
import { theme } from "./theme/index.js";

// A component that ignores some or all of `PageProps` (e.g. NowPlayingPage, which
// never navigates anywhere) is still structurally assignable to this map's value type,
// so every entry can be listed uniformly here regardless of which props it actually
// uses.
const PAGES: Record<ViewId, (props: PageProps) => JSX.Element> = {
  "now-playing": NowPlayingPage,
  scrobbles: ScrobblesPage,
  profile: ProfilePage,
  friends: FriendsPage,
  preferences: PreferencesPage,
};

export function App(): JSX.Element {
  const [activeView, setActiveView] = useState<ViewId>("now-playing");
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const ActivePage = PAGES[activeView];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
        <Box sx={{ display: "flex", height: "100vh" }}>
          <NavigationSidebar
            activeView={activeView}
            onSelectView={setActiveView}
            onReportBug={() => {
              setBugReportOpen(true);
            }}
          />
          <Box component="main" sx={{ flexGrow: 1, overflow: "auto" }}>
            <ActivePage
              onNavigateToPreferences={() => {
                setActiveView("preferences");
              }}
              onNavigateToProfile={() => {
                setActiveView("profile");
              }}
            />
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

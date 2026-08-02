import { useState, type JSX } from "react";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { NavigationSidebar, type ViewId } from "./components/NavigationSidebar.js";
import { FriendsPage } from "./pages/FriendsPage.js";
import { NowPlayingPage } from "./pages/NowPlayingPage.js";
import { PreferencesPage } from "./pages/PreferencesPage.js";
import { ProfilePage } from "./pages/ProfilePage.js";
import { ScrobblesPage } from "./pages/ScrobblesPage.js";
import { theme } from "./theme/index.js";

const PAGES: Record<ViewId, () => JSX.Element> = {
  "now-playing": NowPlayingPage,
  scrobbles: ScrobblesPage,
  profile: ProfilePage,
  friends: FriendsPage,
  preferences: PreferencesPage,
};

export function App(): JSX.Element {
  const [activeView, setActiveView] = useState<ViewId>("now-playing");
  const ActivePage = PAGES[activeView];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", height: "100vh" }}>
        <NavigationSidebar activeView={activeView} onSelectView={setActiveView} />
        <Box component="main" sx={{ flexGrow: 1, overflow: "auto" }}>
          <ActivePage />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

import { useMemo, type JSX } from "react";
import LaunchIcon from "@mui/icons-material/Launch";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import Stack from "@mui/material/Stack";
import { ThemeProvider } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { SnackbarProvider } from "./contexts/SnackbarProvider.js";
import { TrackLoveTagControls } from "./components/shared/TrackLoveTagControls.js";
import { useNowPlaying } from "./hooks/use-now-playing.js";
import { useSettings } from "./hooks/use-settings.js";
import { createAppTheme } from "./theme/index.js";

/**
 * The tray/menu-bar mini-player popover's own view — loaded into the *same* renderer
 * bundle as the full app (see `create-tray-popover-window.ts` for why), mounted
 * instead of `App` when `main.tsx` sees the `#tray-popover` URL hash. Deliberately
 * lightweight: just what's currently playing (via the same `useNowPlaying` hook
 * `NowPlayingPage` uses) plus a love/tag toggle and a way to open the full app —
 * everything else (Scrobbles history, Profile, Friends, Settings) stays behind that
 * "open the full app" button rather than trying to cram a second copy of this app's
 * whole navigation into a 320x180 popover.
 *
 * Gets its own `ThemeProvider`/`SnackbarProvider` rather than sharing `App`'s — this
 * is a genuinely separate window with its own React tree, not a route inside the same
 * one, so nothing about `App`'s own component state (or its providers' context) is
 * reachable from here regardless.
 */
export function TrayPopover(): JSX.Element {
  const { settings } = useSettings();
  const theme = useMemo(() => createAppTheme(settings.themeMode), [settings.themeMode]);
  const { track } = useNowPlaying();

  const handleOpenApp = (): void => {
    void window.appInfo?.showMainWindow();
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
        <Box
          sx={{
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            p: 2,
            border: 1,
            borderColor: "divider",
            boxSizing: "border-box",
          }}
        >
          {track ? (
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                <MusicNoteIcon fontSize="small" color="primary" />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {track.sourceApp}
                </Typography>
              </Stack>
              <Typography variant="body1" sx={{ fontWeight: 600 }} noWrap>
                {track.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {track.artist}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Nothing playing right now.
            </Typography>
          )}

          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            {track ? (
              <TrackLoveTagControls artist={track.artist} track={track.title} />
            ) : (
              <Box />
            )}
            <Button size="small" endIcon={<LaunchIcon fontSize="small" />} onClick={handleOpenApp}>
              Open App
            </Button>
          </Stack>
        </Box>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

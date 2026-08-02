import type { JSX } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { LoginPrompt } from "../components/LoginPrompt.js";
import { ScrobbleListItem } from "../components/ScrobbleListItem.js";
import { useAuth } from "../hooks/use-auth.js";
import { useRecentTracks } from "../hooks/use-recent-tracks.js";
import type { PageProps } from "./page-props.js";

export function ScrobblesPage({ onNavigateToPreferences }: PageProps): JSX.Element {
  const { activeAccount } = useAuth();
  const { tracks, loading, error } = useRecentTracks(activeAccount);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Scrobbles
      </Typography>

      {!activeAccount ? (
        <LoginPrompt
          message="Log in with Last.fm on the Preferences page to see your scrobble history."
          onNavigateToPreferences={onNavigateToPreferences}
        />
      ) : loading ? (
        <CircularProgress size={24} />
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : tracks.length === 0 ? (
        <Typography color="text.secondary">No scrobbles yet.</Typography>
      ) : (
        <Paper variant="outlined">
          <List disablePadding>
            {tracks.map((track, index) => (
              // Last.fm gives no stable id for a recent-track entry; the index is safe
              // here since this list is re-fetched wholesale, never reordered in place.
              <ScrobbleListItem key={`${track.artist}-${track.track}-${index}`} track={track} />
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}

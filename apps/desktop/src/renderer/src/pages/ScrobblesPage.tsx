import type { JSX } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { useAuth } from "../hooks/use-auth.js";
import { useRecentTracks } from "../hooks/use-recent-tracks.js";

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export function ScrobblesPage(): JSX.Element {
  const { activeAccount } = useAuth();
  const { tracks, loading, error } = useRecentTracks(activeAccount);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Scrobbles
      </Typography>

      {!activeAccount ? (
        <Typography color="text.secondary">
          Log in with Last.fm on the Preferences page to see your scrobble history.
        </Typography>
      ) : loading ? (
        <CircularProgress size={24} />
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : tracks.length === 0 ? (
        <Typography color="text.secondary">No scrobbles yet.</Typography>
      ) : (
        <List>
          {tracks.map((track, index) => (
            // Last.fm gives no stable id for a recent-track entry; the index is safe
            // here since this list is re-fetched wholesale, never reordered in place.
            <ListItem key={`${track.artist}-${track.track}-${index}`} divider>
              <ListItemText
                primary={track.track}
                secondary={`${track.artist}${track.album ? ` — ${track.album}` : ""}`}
              />
              {track.nowPlaying ? (
                <Chip label="Now Playing" size="small" color="primary" />
              ) : track.timestamp !== undefined ? (
                <Typography variant="caption" color="text.secondary">
                  {formatTimestamp(track.timestamp)}
                </Typography>
              ) : null}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}

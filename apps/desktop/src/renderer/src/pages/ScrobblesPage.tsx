import type { JSX } from "react";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import Paper from "@mui/material/Paper";
import { AsyncState } from "../components/AsyncState.js";
import { LoginPrompt } from "../components/LoginPrompt.js";
import { PageHeader } from "../components/PageHeader.js";
import { ScrobbleListItem } from "../components/ScrobbleListItem.js";
import { useAuth } from "../hooks/use-auth.js";
import { useRecentTracks } from "../hooks/use-recent-tracks.js";
import type { PageProps } from "./page-props.js";

export function ScrobblesPage({ onNavigateToSettings, onSelectScrobble }: PageProps): JSX.Element {
  const { activeAccount } = useAuth();
  const { tracks, loading, error } = useRecentTracks(activeAccount);

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Scrobbles"
        subtitle={activeAccount ? `Showing recent activity for ${activeAccount}` : undefined}
      />

      {!activeAccount ? (
        <LoginPrompt
          message="Log in with Last.fm on the Settings page to see your scrobble history."
          onNavigateToSettings={onNavigateToSettings}
        />
      ) : loading ? (
        <AsyncState kind="loading" label="Loading scrobbles…" />
      ) : error ? (
        <AsyncState kind="error" message={error} />
      ) : tracks.length === 0 ? (
        <AsyncState kind="empty" icon={<LibraryMusicIcon sx={{ fontSize: 48 }} />} message="No scrobbles yet." />
      ) : (
        <Paper variant="outlined">
          <List disablePadding>
            {tracks.map((track, index) => (
              // Last.fm gives no stable id for a recent-track entry; the index is safe
              // here since this list is re-fetched wholesale, never reordered in place.
              <ScrobbleListItem
                key={`${track.artist}-${track.track}-${index}`}
                track={track}
                {...(onSelectScrobble ? { onSelect: onSelectScrobble } : {})}
              />
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}

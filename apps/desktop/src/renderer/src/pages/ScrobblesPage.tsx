import type { JSX } from "react";
import { useMemo, useState } from "react";
import ClearIcon from "@mui/icons-material/Clear";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import SearchIcon from "@mui/icons-material/Search";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import type { RecentTrack } from "@lastfm-scrobbler/core";
import { AsyncState } from "../components/AsyncState.js";
import { LoginPrompt } from "../components/LoginPrompt.js";
import { PageHeader } from "../components/PageHeader.js";
import { ScrobbleListItem } from "../components/ScrobbleListItem.js";
import { useAuth } from "../hooks/use-auth.js";
import { useRecentTracks } from "../hooks/use-recent-tracks.js";
import type { PageProps } from "./page-props.js";

// Matches track title and artist (the two fields ScrobbleListItem itself leads with)
// plus album — searching an album name to find every scrobble from it is a real,
// common use case a plain title/artist match would miss entirely. Same
// case-insensitive substring convention as FriendsPage's own `matchesSearch`.
function matchesSearch(track: RecentTrack, query: string): boolean {
  return (
    track.track.toLowerCase().includes(query) ||
    track.artist.toLowerCase().includes(query) ||
    (track.album?.toLowerCase().includes(query) ?? false)
  );
}

export function ScrobblesPage({ onNavigateToSettings, onSelectScrobble }: PageProps): JSX.Element {
  const { activeAccount } = useAuth();
  const { tracks, loading, error } = useRecentTracks(activeAccount);
  const [searchQuery, setSearchQuery] = useState("");

  const visibleTracks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return query ? tracks.filter((track) => matchesSearch(track, query)) : tracks;
  }, [tracks, searchQuery]);

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
        <>
          <TextField
            size="small"
            placeholder="Search scrobbles"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
            sx={{ mb: 1.5, maxWidth: 480 }}
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label="Clear search"
                      onClick={() => {
                        setSearchQuery("");
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />

          {visibleTracks.length === 0 ? (
            <AsyncState
              kind="empty"
              icon={<SearchOffIcon sx={{ fontSize: 48 }} />}
              message={`No scrobbles match "${searchQuery}".`}
            />
          ) : (
            <Paper variant="outlined">
              <List disablePadding>
                {visibleTracks.map((track, index) => (
                  // Last.fm gives no stable id for a recent-track entry; the index is
                  // safe here since this list is re-fetched wholesale, never reordered
                  // in place.
                  <ScrobbleListItem
                    key={`${track.artist}-${track.track}-${index}`}
                    track={track}
                    {...(onSelectScrobble ? { onSelect: onSelectScrobble } : {})}
                  />
                ))}
              </List>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}

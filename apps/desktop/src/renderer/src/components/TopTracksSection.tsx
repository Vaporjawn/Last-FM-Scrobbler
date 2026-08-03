import type { JSX } from "react";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import type { TopTrack } from "@lastfm-scrobbler/core";
import { AsyncState } from "./AsyncState.js";
import { TopTrackListItem } from "./TopTrackListItem.js";

export interface TopTracksSectionProps {
  readonly title: string;
  readonly tracks: readonly TopTrack[];
  readonly loading: boolean;
  readonly error: string | undefined;
  readonly emptyMessage: string;
}

/**
 * `ProfilePage`'s Top Tracks section — same loading/error/empty handling
 * `TopArtistsSection` uses, but list-only: unlike artists and albums, Last.fm has no
 * real per-track art to show (see `TopTrack`'s docstring), so a tile grid of
 * `TopTrackListItem`'s photo-of-the-artist stand-ins would just repeat the same photo
 * for every track by the same artist, which reads as a bug, not a feature — a judgment
 * call made explicitly, unlike `TopArtistsSection`/`TopAlbumsSection`'s genuine
 * list/tiles choice. Also, deliberately just one section ("Overall", no "This Week"
 * companion): a 7-day top-tracks list is, for most listeners, either empty or nearly
 * identical to their 7-day top-artists list, and doesn't carry its own weight as a
 * second section the way This Week vs. Overall does for artists, where the two
 * timeframes genuinely diverge. `useTopTracks`/`getTopTracks` still support `period`
 * for a future caller that wants one.
 */
export function TopTracksSection({
  title,
  tracks,
  loading,
  error,
  emptyMessage,
}: TopTracksSectionProps): JSX.Element {
  const maxPlayCount = Math.max(1, ...tracks.map((track) => track.playCount));

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" gutterBottom>
        {title}
      </Typography>
      {loading ? (
        <AsyncState kind="loading" label={`Loading ${title.toLowerCase()}…`} />
      ) : error ? (
        <AsyncState kind="error" message={error} />
      ) : tracks.length === 0 ? (
        <AsyncState kind="empty" icon={<MusicNoteIcon sx={{ fontSize: 48 }} />} message={emptyMessage} />
      ) : (
        <List disablePadding sx={{ maxWidth: 480 }}>
          {tracks.map((track, index) => (
            <TopTrackListItem
              key={`${track.artist}-${track.name}`}
              track={track}
              rank={index + 1}
              maxPlayCount={maxPlayCount}
            />
          ))}
        </List>
      )}
    </Box>
  );
}

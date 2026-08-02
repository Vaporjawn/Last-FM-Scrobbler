import type { JSX } from "react";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import type { TopArtist } from "@lastfm-scrobbler/core";
import { AsyncState } from "./AsyncState.js";
import { TopArtistListItem } from "./TopArtistListItem.js";
import { TopArtistTile } from "./TopArtistTile.js";

export type TopArtistsViewMode = "list" | "tiles";

export interface TopArtistsSectionProps {
  readonly title: string;
  readonly artists: readonly TopArtist[];
  readonly loading: boolean;
  readonly error: string | undefined;
  readonly viewMode: TopArtistsViewMode;
  /** Shown in the empty state once loaded with no artists — worded per section
   * ("No scrobbles yet" for all-time, "No scrobbles this week" for the 7-day window),
   * since an empty "this week" section is a completely normal, expected state for an
   * account with real all-time history, not the same "you've never scrobbled
   * anything" case the all-time section's empty state describes. */
  readonly emptyMessage: string;
}

/**
 * One of ProfilePage's two Top Artists sections (This Week, Overall) — same
 * loading/error/empty handling and the same `viewMode` choice between
 * `TopArtistListItem`'s row-with-bar list and `TopArtistTile`'s image-grid, factored
 * out here since both sections need it identically apart from their data, title, and
 * empty-state wording. Each section computes its own `maxPlayCount` independently
 * (see the `list` branch below) — a "this week" bar scaled against the "overall"
 * section's much larger counts would read as misleadingly short.
 */
export function TopArtistsSection({
  title,
  artists,
  loading,
  error,
  viewMode,
  emptyMessage,
}: TopArtistsSectionProps): JSX.Element {
  const maxPlayCount = Math.max(1, ...artists.map((artist) => artist.playCount));

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" gutterBottom>
        {title}
      </Typography>
      {loading ? (
        <AsyncState kind="loading" label={`Loading ${title.toLowerCase()}…`} />
      ) : error ? (
        <AsyncState kind="error" message={error} />
      ) : artists.length === 0 ? (
        <AsyncState kind="empty" icon={<TrendingUpIcon sx={{ fontSize: 48 }} />} message={emptyMessage} />
      ) : viewMode === "list" ? (
        <List disablePadding sx={{ maxWidth: 480 }}>
          {artists.map((artist, index) => (
            <TopArtistListItem
              key={artist.name}
              artist={artist}
              rank={index + 1}
              maxPlayCount={maxPlayCount}
            />
          ))}
        </List>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 2,
          }}
        >
          {artists.map((artist) => (
            <TopArtistTile key={artist.name} artist={artist} />
          ))}
        </Box>
      )}
    </Box>
  );
}

import type { JSX } from "react";
import AlbumIcon from "@mui/icons-material/Album";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { TopAlbum } from "@lastfm-scrobbler/core";
import { AsyncState } from "./AsyncState.js";
import { TopAlbumListItem } from "./TopAlbumListItem.js";
import { TopAlbumTile } from "./TopAlbumTile.js";

export type TopAlbumsViewMode = "list" | "tiles";

export interface TopAlbumsSectionProps {
  readonly title: string;
  readonly albums: readonly TopAlbum[];
  readonly loading: boolean;
  readonly error: string | undefined;
  readonly viewMode: TopAlbumsViewMode;
  readonly onViewModeChange: (viewMode: TopAlbumsViewMode) => void;
  readonly emptyMessage: string;
}

/**
 * `ProfilePage`'s Top Albums section — same loading/error/empty handling and the same
 * list/tiles choice `TopArtistsSection` offers (unlike `TopTracksSection`, which is
 * list-only: albums genuinely have real per-album art, see `TopAlbum`'s docstring, so
 * a tile grid is worth having here). Deliberately just one section ("Overall", no
 * "This Week" companion) — see `ProfilePage`'s own judgment-call comment on why
 * Tracks/Albums don't repeat the full This-Week/Overall × List/Tiles matrix Top
 * Artists has. Unlike `TopArtistsSection`, the view-mode `Select` lives inside this
 * component's own header row rather than in a separate row `ProfilePage` renders
 * above it: `TopArtistsSection` is instantiated twice (This Week + Overall) sharing
 * one external `Select` above both, but there's only ever one Top Albums section, so
 * a second, external "Top Albums" heading next to its own `Select` would just repeat
 * this component's own title text — folding the two into one header row avoids that.
 */
export function TopAlbumsSection({
  title,
  albums,
  loading,
  error,
  viewMode,
  onViewModeChange,
  emptyMessage,
}: TopAlbumsSectionProps): JSX.Element {
  const maxPlayCount = Math.max(1, ...albums.map((album) => album.playCount));

  const handleViewModeChange = (event: SelectChangeEvent<TopAlbumsViewMode>): void => {
    onViewModeChange(event.target.value);
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 1, maxWidth: 480 }}
      >
        <Typography variant="subtitle1">{title}</Typography>
        <Select
          size="small"
          value={viewMode}
          onChange={handleViewModeChange}
          inputProps={{ "aria-label": `${title} view` }}
        >
          <MenuItem value="list">List</MenuItem>
          <MenuItem value="tiles">Tiles</MenuItem>
        </Select>
      </Stack>
      {loading ? (
        <AsyncState kind="loading" label={`Loading ${title.toLowerCase()}…`} />
      ) : error ? (
        <AsyncState kind="error" message={error} />
      ) : albums.length === 0 ? (
        <AsyncState kind="empty" icon={<AlbumIcon sx={{ fontSize: 48 }} />} message={emptyMessage} />
      ) : viewMode === "list" ? (
        <List disablePadding sx={{ maxWidth: 480 }}>
          {albums.map((album, index) => (
            <TopAlbumListItem
              key={`${album.artist}-${album.name}`}
              album={album}
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
          {albums.map((album) => (
            <TopAlbumTile key={`${album.artist}-${album.name}`} album={album} />
          ))}
        </Box>
      )}
    </Box>
  );
}

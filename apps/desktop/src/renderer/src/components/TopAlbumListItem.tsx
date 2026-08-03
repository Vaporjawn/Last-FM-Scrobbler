import type { JSX } from "react";
import Box from "@mui/material/Box";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { TopAlbum } from "@lastfm-scrobbler/core";
import { TrackArtworkAvatar } from "./shared/TrackArtworkAvatar.js";

const AVATAR_SIZE = 48;
/** Same indent-math approach as `TopArtistListItem`'s own `BAR_INDENT_PX`. */
const BAR_INDENT_PX = 20 + 12 + AVATAR_SIZE + 12;

export interface TopAlbumListItemProps {
  readonly album: TopAlbum;
  /** 1-based position in the list — shown as a plain rank number, not an index. */
  readonly rank: number;
  /** The list's own highest play count, for scaling this row's relative-play bar. */
  readonly maxPlayCount: number;
}

/**
 * One row of `ProfilePage`'s Top Albums list: rank, the album's own real cover art
 * (`album.imageUrl` — genuinely per-album, unlike `TopTrack`'s; see that field's
 * docstring — via `TrackArtworkAvatar`, the same real-artwork-with-note-icon-fallback
 * treatment `ScrobbleListItem`/`FriendListItem` already use, with `nowPlaying` always
 * `false` here since nothing about a top-albums ranking is "currently playing"), album
 * title (primary) with artist name and play count (secondary), and a relative-play bar
 * — same layout as `TopArtistListItem`/`TopTrackListItem`, adapted for real art instead
 * of a fetched photo.
 */
export function TopAlbumListItem({ album, rank, maxPlayCount }: TopAlbumListItemProps): JSX.Element {
  return (
    <ListItem divider sx={{ display: "block", px: 0, py: 1.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ width: 20, flexShrink: 0, textAlign: "right" }}
        >
          {rank}
        </Typography>
        <TrackArtworkAvatar
          imageUrl={album.imageUrl}
          title={album.name}
          nowPlaying={false}
          size={AVATAR_SIZE}
        />
        <ListItemText
          primary={album.name}
          secondary={`${album.artist} — ${album.playCount} play${album.playCount === 1 ? "" : "s"}`}
          sx={{ my: 0 }}
          slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
        />
      </Stack>
      <Box
        sx={{
          height: 4,
          mt: 1,
          ml: `${BAR_INDENT_PX}px`,
          borderRadius: 2,
          bgcolor: "action.hover",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: `${(album.playCount / maxPlayCount) * 100}%`,
            bgcolor: "primary.main",
          }}
        />
      </Box>
    </ListItem>
  );
}

import type { JSX } from "react";
import Box from "@mui/material/Box";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { TopTrack } from "@lastfm-scrobbler/core";
import { ArtistAvatar } from "./ArtistAvatar.js";

const AVATAR_SIZE = 48;
/** Same indent-math approach as `TopArtistListItem`'s own `BAR_INDENT_PX` — lines the
 * play-count bar up under the track title (rank column + avatar + the two gaps
 * between them). */
const BAR_INDENT_PX = 20 + 12 + AVATAR_SIZE + 12;

export interface TopTrackListItemProps {
  readonly track: TopTrack;
  /** 1-based position in the list — shown as a plain rank number, not an index. */
  readonly rank: number;
  /** The list's own highest play count, for scaling this row's relative-play bar. */
  readonly maxPlayCount: number;
}

/**
 * One row of `ProfilePage`'s Top Tracks list: rank, the track's own artist's real
 * photo (via `ArtistAvatar` — Last.fm's `user.getTopTracks` itself only ever returns
 * the shared placeholder graphic for every track, see `TopTrack`'s docstring, so
 * there's no real per-track art to show; the artist's photo is the closest genuine
 * image available and the same visual language `TopArtistListItem` already
 * establishes), track title (primary) with artist name and play count (secondary),
 * and a bar showing that count relative to the list's highest — same layout as
 * `TopArtistListItem`, adapted for a track having an artist of its own to show
 * alongside its play count.
 */
export function TopTrackListItem({ track, rank, maxPlayCount }: TopTrackListItemProps): JSX.Element {
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
        <ArtistAvatar name={track.artist} size={AVATAR_SIZE} />
        {/* `minWidth: 0` — a flex item's default min-width is `auto` (its content's
            own intrinsic minimum), not 0, so without this the text refuses to shrink
            below that and overflows the row instead of the `noWrap`/ellipsis
            treatment below actually taking effect — same fix, same root cause, as
            `ScrobbleListItem`'s equivalent `ListItemText`. */}
        <ListItemText
          primary={track.name}
          secondary={`${track.artist} — ${track.playCount} play${track.playCount === 1 ? "" : "s"}`}
          sx={{ my: 0, minWidth: 0 }}
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
            width: `${(track.playCount / maxPlayCount) * 100}%`,
            bgcolor: "primary.main",
          }}
        />
      </Box>
    </ListItem>
  );
}

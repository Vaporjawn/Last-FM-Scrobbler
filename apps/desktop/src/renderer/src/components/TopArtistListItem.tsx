import type { JSX } from "react";
import Box from "@mui/material/Box";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { TopArtist } from "@lastfm-scrobbler/core";
import { ArtistAvatar } from "./ArtistAvatar.js";

const AVATAR_SIZE = 48;
/** Left offset that lines the play-count bar up under the artist name (rank column +
 * avatar + the two gaps between them — see the Stack below). */
const BAR_INDENT_PX = 20 + 12 + AVATAR_SIZE + 12;

export interface TopArtistListItemProps {
  readonly artist: TopArtist;
  /** 1-based position in the list — shown as a plain rank number, not an index. */
  readonly rank: number;
  /** The list's own highest play count, for scaling this row's relative-play bar. */
  readonly maxPlayCount: number;
}

/** One row of ProfilePage's Top Artists list: rank, a real artist photo (via
 * `ArtistAvatar` — see its docstring for where that comes from), name, play count, and
 * a bar showing that count relative to the list's highest. The whole row is a real,
 * keyboard-accessible link to the artist's own Last.fm page — same "row becomes a real
 * button" treatment `ScrobbleListItem` uses for its `onSelect` case, just pointed at
 * an external `href`/`target="_blank"` instead of an internal `onClick`. */
export function TopArtistListItem({ artist, rank, maxPlayCount }: TopArtistListItemProps): JSX.Element {
  // Same guessed-URL approach as `ArtistInfoPanel`'s own `artistLastfmUrl` (see
  // there) — `TopArtist` carries no real Last.fm URL of its own to prefer.
  const artistLastfmUrl = `https://www.last.fm/music/${encodeURIComponent(artist.name)}`;

  return (
    <ListItem divider disablePadding>
      {/* `display: "block"` mirrors the plain `ListItem` this replaces (a row `Stack`
          stacked above a block-level bar) — `ListItemButton`'s own default is a flex
          row, which would put the bar beside the Stack instead of underneath it. */}
      <ListItemButton
        component="a"
        href={artistLastfmUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`View ${artist.name} on Last.fm`}
        sx={{ display: "block", px: 0, py: 1.5 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ width: 20, flexShrink: 0, textAlign: "right" }}
          >
            {rank}
          </Typography>
          <ArtistAvatar name={artist.name} size={AVATAR_SIZE} />
          {/* `minWidth: 0` — a flex item's default min-width is `auto` (its content's
              own intrinsic minimum, the longest unbreakable word for text without
              `noWrap`), not 0 — without this, a single long unbroken artist name can
              still overflow the row instead of wrapping within it. Same fix, same root
              cause, as `ScrobbleListItem`'s equivalent `ListItemText`. */}
          <ListItemText
            primary={artist.name}
            secondary={`${artist.playCount} plays`}
            sx={{ my: 0, minWidth: 0 }}
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
              width: `${(artist.playCount / maxPlayCount) * 100}%`,
              bgcolor: "primary.main",
            }}
          />
        </Box>
      </ListItemButton>
    </ListItem>
  );
}

import type { JSX } from "react";
import AlbumIcon from "@mui/icons-material/Album";
import Avatar from "@mui/material/Avatar";

/** The currently-playing track's real album art (via `useTrackImage` — Last.fm's
 * `track.getInfo`) when one is on file, falling back to a gradient/record-icon
 * placeholder otherwise — the same `src`-falls-back-to-children `Avatar` pattern
 * `ScrobbleListItem` already uses for scrobble history's art. */
export function NowPlayingArtwork({
  imageUrl,
  title,
}: {
  imageUrl: string | undefined;
  title: string;
}): JSX.Element {
  return (
    <Avatar
      variant="rounded"
      src={imageUrl}
      alt={title}
      sx={{
        width: 200,
        height: 200,
        flexShrink: 0,
        borderRadius: 2,
        boxShadow: 4,
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
      }}
    >
      <AlbumIcon sx={{ fontSize: 88, color: "rgba(255,255,255,0.85)" }} />
    </Avatar>
  );
}

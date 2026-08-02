import type { JSX } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { TopArtist } from "@lastfm-scrobbler/core";
import { useArtistImage } from "../hooks/use-artist-image.js";

export interface TopArtistTileProps {
  readonly artist: TopArtist;
}

/**
 * One tile of ProfilePage's Top Artists grid (the "tiles" `viewMode` — see
 * `TopArtistsSection`), modeled on Last.fm's own desktop client: a large square photo
 * (`useArtistImage`, same real-photo source `ArtistAvatar`'s row-list treatment uses —
 * see its docstring for why this isn't Last.fm's own artist-image field) with the
 * artist's name and play count overlaid as white text at the bottom over a gradient
 * scrim, rather than `ArtistAvatar`'s small circular avatar-plus-adjacent-text
 * treatment `TopArtistListItem`'s list rows use — a tile has no room next to it for
 * text, so the text has to sit on top of the photo instead. Falls back to a plain
 * initial-letter tile (no photo, no scrim needed) when no real photo is found, same
 * "never fails, just shows less" contract every other real-photo spot in this app
 * follows.
 */
export function TopArtistTile({ artist }: TopArtistTileProps): JSX.Element {
  const imageUrl = useArtistImage(artist.name);

  return (
    <Box
      sx={{
        position: "relative",
        aspectRatio: "1",
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "action.selected",
        ...(imageUrl
          ? {
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : {}),
      }}
    >
      {!imageUrl ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="h4" color="text.secondary">
            {artist.name.slice(0, 1).toUpperCase()}
          </Typography>
        </Box>
      ) : null}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          p: 1,
          background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
        }}
      >
        <Typography variant="body2" noWrap sx={{ color: "#fff", fontWeight: 600 }}>
          {artist.name}
        </Typography>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.85)" }}>
          {artist.playCount} play{artist.playCount === 1 ? "" : "s"}
        </Typography>
      </Box>
    </Box>
  );
}

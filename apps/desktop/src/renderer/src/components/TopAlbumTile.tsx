import type { JSX } from "react";
import AlbumIcon from "@mui/icons-material/Album";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { TopAlbum } from "@lastfm-scrobbler/core";

export interface TopAlbumTileProps {
  readonly album: TopAlbum;
}

/**
 * One tile of `ProfilePage`'s Top Albums grid (the "tiles" `viewMode` — see
 * `TopAlbumsSection`), modeled directly on `TopArtistTile`: a large square photo with
 * the album's name and play count overlaid at the bottom over a gradient scrim. Unlike
 * `TopArtistTile`, no separate image-fetch hook is needed — `album.imageUrl` is
 * already real, per-album art straight from `getTopAlbums` (see `TopAlbum`'s
 * docstring), not something that needs a Deezer lookup the way artist photos do.
 * Falls back to a plain album-icon tile (no photo, no scrim needed) when Last.fm has
 * no art on file for this particular album, same "never fails, just shows less"
 * contract every other real-photo spot in this app follows.
 */
export function TopAlbumTile({ album }: TopAlbumTileProps): JSX.Element {
  return (
    <Box
      sx={{
        position: "relative",
        aspectRatio: "1",
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "action.selected",
        ...(album.imageUrl
          ? {
              backgroundImage: `url(${album.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : {}),
      }}
    >
      {!album.imageUrl ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AlbumIcon sx={{ fontSize: 40, color: "text.secondary" }} />
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
          {album.name}
        </Typography>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.85)" }}>
          {album.playCount} play{album.playCount === 1 ? "" : "s"}
        </Typography>
      </Box>
    </Box>
  );
}

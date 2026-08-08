import type { JSX } from "react";
import AlbumIcon from "@mui/icons-material/Album";
import type { TopAlbum } from "@lastfm-scrobbler/core";
import { ArtworkTile } from "./shared/ArtworkTile.js";

export interface TopAlbumTileProps {
  readonly album: TopAlbum;
}

/**
 * One tile of `ProfilePage`'s Top Albums grid (the "tiles" `viewMode` — see
 * `TopAlbumsSection`), modeled directly on `TopArtistTile`: a large square photo with
 * the album's name and play count overlaid at the bottom, via the shared `ArtworkTile`
 * both tiles now share (see its own docstring). Unlike `TopArtistTile`, no separate
 * image-fetch hook is needed — `album.imageUrl` is already real, per-album art
 * straight from `getTopAlbums` (see `TopAlbum`'s docstring), not something that needs
 * a Deezer lookup the way artist photos do. Falls back to a plain album-icon tile (no
 * photo, no scrim needed) when Last.fm has no art on file for this particular album,
 * same "never fails, just shows less" contract every other real-photo spot in this
 * app follows. The whole tile links out to the album's own Last.fm page (see
 * `ArtworkTile.href`'s docstring).
 */
export function TopAlbumTile({ album }: TopAlbumTileProps): JSX.Element {
  // Same guessed-URL shape as `TopAlbumListItem`'s own (see there) —
  // `/music/{artist}/{album}` — since `TopAlbum` carries no real Last.fm URL of its
  // own to prefer.
  const albumLastfmUrl = `https://www.last.fm/music/${encodeURIComponent(album.artist)}/${encodeURIComponent(album.name)}`;

  return (
    <ArtworkTile
      imageUrl={album.imageUrl}
      title={album.name}
      subtitle={`${album.playCount} play${album.playCount === 1 ? "" : "s"}`}
      fallback={<AlbumIcon sx={{ fontSize: 40, color: "text.secondary" }} />}
      href={albumLastfmUrl}
      ariaLabel={`View ${album.name} on Last.fm`}
    />
  );
}

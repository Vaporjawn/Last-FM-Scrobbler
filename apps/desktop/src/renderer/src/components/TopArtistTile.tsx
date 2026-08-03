import type { JSX } from "react";
import Typography from "@mui/material/Typography";
import type { TopArtist } from "@lastfm-scrobbler/core";
import { useArtistImage } from "../hooks/use-artist-image.js";
import { ArtworkTile } from "./shared/ArtworkTile.js";

export interface TopArtistTileProps {
  readonly artist: TopArtist;
}

/**
 * One tile of ProfilePage's Top Artists grid (the "tiles" `viewMode` — see
 * `TopArtistsSection`), modeled on Last.fm's own desktop client: a large square photo
 * (`useArtistImage`, same real-photo source `ArtistAvatar`'s row-list treatment uses —
 * see its docstring for why this isn't Last.fm's own artist-image field) with the
 * artist's name and play count overlaid at the bottom, via the shared `ArtworkTile`
 * (see its own docstring for why that's built on MUI's `ImageListItem`/
 * `ImageListItemBar` rather than a hand-rolled gradient). Falls back to a plain
 * initial-letter tile (no photo, no scrim needed) when no real photo is found, same
 * "never fails, just shows less" contract every other real-photo spot in this app
 * follows.
 */
export function TopArtistTile({ artist }: TopArtistTileProps): JSX.Element {
  const imageUrl = useArtistImage(artist.name);

  return (
    <ArtworkTile
      imageUrl={imageUrl}
      title={artist.name}
      subtitle={`${artist.playCount} play${artist.playCount === 1 ? "" : "s"}`}
      fallback={
        <Typography variant="h4" color="text.secondary">
          {artist.name.slice(0, 1).toUpperCase()}
        </Typography>
      }
    />
  );
}

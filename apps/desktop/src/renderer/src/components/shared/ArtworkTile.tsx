import type { JSX, ReactNode } from "react";
import { useState } from "react";
import Box from "@mui/material/Box";
import ImageListItem from "@mui/material/ImageListItem";
import ImageListItemBar from "@mui/material/ImageListItemBar";

export interface ArtworkTileProps {
  readonly imageUrl: string | undefined;
  readonly title: string;
  /** Already formatted for display (e.g. the caller's own play-count pluralization) —
   * this component doesn't know or care what the subtitle actually represents, same
   * convention as `StatBox.value`. */
  readonly subtitle: string;
  /** Rendered centered over the tile, filling it, in place of a real image whenever
   * `imageUrl` is absent — an initial-letter `Typography` for `TopArtistTile`, an
   * `AlbumIcon` for `TopAlbumTile`. Each caller supplies its own, since what a
   * "no artwork" placeholder should look like differs by what's being tiled. */
  readonly fallback: ReactNode;
}

/**
 * A square artwork tile with its title/subtitle overlaid on a gradient scrim at the
 * bottom — `ProfilePage`'s Top Artists/Top Albums grids (the "tiles" `viewMode`, see
 * `TopArtistsSection`/`TopAlbumsSection`), modeled on Last.fm's own desktop client.
 * Built on MUI's `ImageListItem`/`ImageListItemBar` rather than a hand-rolled
 * `backgroundImage` + absolutely-positioned gradient `Box` (which `TopArtistTile` and
 * `TopAlbumTile` each used to reimplement independently, near-identically apart from
 * the fallback content and where the image URL came from) — `ImageListItemBar` owns
 * the scrim/title/subtitle/ellipsis treatment MUI already ships for exactly this
 * "image with a caption bar" shape, instead of two near-duplicate copies of it with
 * hardcoded `rgba(0,0,0,0.8)`/`#fff` colors that bypass the theme entirely.
 *
 * `component="div"` on `ImageListItem` — its default root is `<li>`, meant for use
 * inside a real `ImageList` (which renders as `<ul>`); both call sites instead lay
 * tiles out in a plain CSS-grid `Box`, so `<li>` there would be invalid markup (an
 * `<li>` with no `<ul>`/`<ol>` parent) even though it would render visually fine.
 */
export function ArtworkTile({ imageUrl, title, subtitle, fallback }: ArtworkTileProps): JSX.Element {
  // Tracks the specific URL that failed to load (not just a bare boolean) so that if
  // `imageUrl` later changes to a genuinely different URL, the new one gets a fresh
  // chance to load instead of being permanently stuck showing the fallback. Without
  // this, a 404'd/otherwise-failed artwork URL (network-sourced — Deezer artist
  // photos, Last.fm album art, either of which can fail after this component has
  // already decided `imageUrl` is defined) rendered the browser's native broken-image
  // icon instead of `fallback` — contradicting this component's own "never fails,
  // just shows less" contract that every other real-photo component in this app
  // follows (ArtistAvatar, TrackArtworkAvatar, SubscriberAvatar).
  const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined);
  const showFallback = !imageUrl || imageUrl === failedUrl;

  return (
    <ImageListItem
      component="div"
      sx={{ aspectRatio: "1", borderRadius: 2, overflow: "hidden", bgcolor: "action.selected" }}
    >
      {showFallback ? (
        <Box
          sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {fallback}
        </Box>
      ) : (
        <img
          src={imageUrl}
          alt={title}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => {
            setFailedUrl(imageUrl);
          }}
        />
      )}
      <ImageListItemBar title={title} subtitle={subtitle} />
    </ImageListItem>
  );
}

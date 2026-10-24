import { type DeezerArtistJson } from "./deezer-artist-json.js";

/**
 * Deezer's own shared "no photo on file" placeholder — every image URL for an artist
 * with no real photo embeds this exact path segment instead of a per-artist hash.
 * Verified live: searching generically-named catalog entries ("DJ", "Unknown") that
 * plainly have no real photo returns this hash, while every genuinely-named real
 * artist gets a distinct one. It's the MD5 hash of an empty string
 * (`d41d8cd98f00b204e9800998ecf8427e`) — Deezer's own sentinel for "nothing here",
 * not a coincidence. Same category of gotcha as Last.fm's own artist-image
 * placeholder (see `ArtistInfo`'s docstring in `../lastfm-api/types.ts`), so it gets
 * the same treatment: detect it and treat it as no image at all.
 */
const DEEZER_NO_PHOTO_HASH = "d41d8cd98f00b204e9800998ecf8427e";
/** The largest available picture for `artist`, or `undefined` if it's missing or is
 * Deezer's own "no photo" placeholder (see `DEEZER_NO_PHOTO_HASH`). */
export function pickRealPhotoUrl(artist: DeezerArtistJson): string | undefined {
  const imageUrl = artist.picture_xl ?? artist.picture_big ?? artist.picture_medium;
  return imageUrl && !imageUrl.includes(DEEZER_NO_PHOTO_HASH) ? imageUrl : undefined;
}

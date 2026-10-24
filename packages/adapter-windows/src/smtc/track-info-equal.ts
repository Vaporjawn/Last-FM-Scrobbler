import type { TrackInfo } from "@lastfm-scrobbler/shared-types";

/**
 * Field-by-field equality of two `TrackInfo` values. Unlike reference equality, two distinct
 * objects with the same fields are equal; if either side is `undefined` (nothing emitted
 * yet) the result is `false`, so the first track seen is always treated as new.
 */
export function trackInfoEqual(a: TrackInfo | undefined, b: TrackInfo | undefined): boolean {
  if (!a || !b) {
    return false;
  }
  return (
    a.title === b.title &&
    a.artist === b.artist &&
    a.album === b.album &&
    a.albumArtist === b.albumArtist &&
    a.durationSec === b.durationSec &&
    a.sourceApp === b.sourceApp &&
    a.isStream === b.isStream
  );
}

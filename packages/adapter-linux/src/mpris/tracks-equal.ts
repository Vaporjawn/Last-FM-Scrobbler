import type { TrackInfo } from "@lastfm-scrobbler/shared-types";

/**
 * Structural equality of two `TrackInfo` values (or two `null`s), comparing every field.
 * Used to suppress redundant updates when a player re-sends metadata that has not
 * actually changed.
 */
export function tracksEqual(a: TrackInfo | null, b: TrackInfo | null): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
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

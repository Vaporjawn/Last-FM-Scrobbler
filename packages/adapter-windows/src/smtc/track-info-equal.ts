import type { TrackInfo } from "@lastfm-scrobbler/shared-types";

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

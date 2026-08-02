import type { TrackInfo } from "@lastfm-scrobbler/shared-types";

/**
 * Bucket width for start-time grouping — see docs/adr/0005. Two reports of the same
 * (artist, title, album) starting within this many seconds of each other are treated
 * as the same play (guards against a flaky adapter re-firing "track changed" for a
 * play already in progress); starting further apart is a distinct, later listen and
 * gets its own identity.
 */
const START_TIME_BUCKET_SEC = 5;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * A stable identity for "this specific play of this track" — normalized
 * artist/title/album, bucketed by start time. Used by the tracker to distinguish a
 * genuinely new play from a redundant re-report of the one already in progress.
 */
export function computeTrackIdentity(track: TrackInfo, startedAtSec: number): string {
  const bucket = Math.floor(startedAtSec / START_TIME_BUCKET_SEC);
  const albumKey = track.album ? normalize(track.album) : "";
  return `${normalize(track.artist)}::${normalize(track.title)}::${albumKey}::${bucket}`;
}

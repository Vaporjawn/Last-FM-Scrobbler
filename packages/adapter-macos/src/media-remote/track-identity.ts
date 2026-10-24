import type { TrackInfo } from "@lastfm-scrobbler/shared-types";

/** A stable key identifying "the same track" across payload diffs, for change detection. */
export function trackIdentity(track: TrackInfo): string {
  return `${track.artist}::${track.title}::${track.album ?? ""}`;
}

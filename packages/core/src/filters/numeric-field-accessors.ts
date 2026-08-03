import type { FilterableTrack } from "./filterable-track.js";

/**
 * Maps each numeric-typed filter expression field name to a function that reads it off
 * a track. Returns `undefined` (rather than a sentinel like `0` or `-1`) when the track
 * has no known duration, so comparisons against it can be treated as "unknown" instead
 * of silently comparing against a fabricated number.
 */
export const NUMERIC_FIELD_ACCESSORS: Record<
  string,
  (track: FilterableTrack) => number | undefined
> = {
  durationSec: (t) => t.durationSec,
};

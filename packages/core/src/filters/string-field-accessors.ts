import type { FilterableTrack } from "./filterable-track.js";

/**
 * Maps each string-typed filter expression field name to a function that reads it off
 * a track. `album`/`albumArtist` fall back to `""` rather than `undefined` so a filter
 * expression like `album = ""` can still match tracks with no album metadata, instead
 * of every string comparison needing its own optional-field special case.
 */
export const STRING_FIELD_ACCESSORS: Record<string, (track: FilterableTrack) => string> = {
  artist: (t) => t.artist,
  title: (t) => t.title,
  album: (t) => t.album ?? "",
  albumArtist: (t) => t.albumArtist ?? "",
  sourceApp: (t) => t.sourceApp,
};

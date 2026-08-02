/** The track shape exclusion filters evaluate against — see docs/adr/0005. */
export interface FilterableTrack {
  readonly artist: string;
  readonly title: string;
  readonly album?: string;
  readonly albumArtist?: string;
  readonly durationSec?: number;
  readonly sourceApp: string;
}

export const STRING_FIELD_ACCESSORS: Record<string, (track: FilterableTrack) => string> = {
  artist: (t) => t.artist,
  title: (t) => t.title,
  album: (t) => t.album ?? "",
  albumArtist: (t) => t.albumArtist ?? "",
  sourceApp: (t) => t.sourceApp,
};

export const NUMERIC_FIELD_ACCESSORS: Record<
  string,
  (track: FilterableTrack) => number | undefined
> = {
  durationSec: (t) => t.durationSec,
};

export function isStringField(name: string): boolean {
  return name in STRING_FIELD_ACCESSORS;
}

export function isNumericField(name: string): boolean {
  return name in NUMERIC_FIELD_ACCESSORS;
}

export function isKnownField(name: string): boolean {
  return isStringField(name) || isNumericField(name);
}

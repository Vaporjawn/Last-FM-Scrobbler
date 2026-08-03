/** The track shape exclusion filters evaluate against — see docs/adr/0005. */
export interface FilterableTrack {
  readonly artist: string;
  readonly title: string;
  readonly album?: string;
  readonly albumArtist?: string;
  readonly durationSec?: number;
  readonly sourceApp: string;
}

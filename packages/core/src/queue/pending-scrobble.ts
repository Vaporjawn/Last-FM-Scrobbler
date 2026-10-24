/** A scrobble waiting to be submitted to Last.fm. */
export interface PendingScrobble {
  readonly artist: string;
  readonly track: string;
  readonly album?: string;
  readonly albumArtist?: string;
  /** Unix seconds — when the track *started* playing, per Last.fm's scrobble API. */
  readonly timestamp: number;
  readonly durationSec?: number;
}

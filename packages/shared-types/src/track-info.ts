/**
 * The OS-independent description of a track, produced by each platform adapter from its
 * native now-playing data (MPRIS metadata, SMTC, MediaRemote) and passed to
 * `PlaybackSource.onTrackChanged` listeners. Optional fields are omitted, not set to
 * `undefined`, when the source does not report them.
 */
export interface TrackInfo {
  readonly title: string;
  readonly artist: string;
  readonly album?: string;
  readonly albumArtist?: string;
  readonly durationSec?: number;
  readonly sourceApp: string;
  readonly isStream: boolean;
}

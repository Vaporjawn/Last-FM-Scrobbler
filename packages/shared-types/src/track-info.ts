export interface TrackInfo {
  readonly title: string;
  readonly artist: string;
  readonly album?: string;
  readonly albumArtist?: string;
  readonly durationSec?: number;
  readonly sourceApp: string;
  readonly isStream: boolean;
}

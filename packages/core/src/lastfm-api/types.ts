export interface ScrobbleSubmission {
  readonly artist: string;
  readonly track: string;
  /** Unix seconds — when the track started playing. */
  readonly timestamp: number;
  readonly album?: string;
  readonly albumArtist?: string;
  readonly durationSec?: number;
  readonly trackNumber?: number;
  readonly mbid?: string;
}

export interface NowPlayingSubmission {
  readonly artist: string;
  readonly track: string;
  readonly album?: string;
  readonly albumArtist?: string;
  readonly durationSec?: number;
  readonly trackNumber?: number;
  readonly mbid?: string;
}

export interface LastfmSession {
  readonly username: string;
  readonly sessionKey: string;
  readonly isSubscriber: boolean;
}

export interface ScrobbleResultItem {
  readonly track: string;
  /** 0 when accepted; see isRetryableScrobbleIgnoreCode for the ignore code meanings. */
  readonly ignoredCode: number;
  readonly retryable: boolean;
}

export interface ScrobbleBatchResult {
  readonly accepted: number;
  readonly ignored: number;
  readonly results: readonly ScrobbleResultItem[];
}

export interface TrackRef {
  readonly artist: string;
  readonly track: string;
}

export interface RecentTrack {
  readonly artist: string;
  readonly track: string;
  readonly album?: string;
  readonly nowPlaying: boolean;
  /** Unix seconds. Absent when `nowPlaying` is true — Last.fm doesn't date those. */
  readonly timestamp?: number;
}

export interface TopArtist {
  readonly name: string;
  readonly playCount: number;
}

export interface Friend {
  readonly username: string;
  readonly realName?: string;
}

export interface ArtistInfo {
  readonly name: string;
  readonly bioSummary?: string;
  readonly listeners: number;
  readonly playCount: number;
}

export interface SimilarArtist {
  readonly name: string;
  readonly match: number;
}

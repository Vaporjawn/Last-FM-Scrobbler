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
  /** Largest available album/track art Last.fm has on file, if any — unlike artist
   * images (see `ArtistInfo` below), these are real cover art and do come through
   * correctly. Omitted when Last.fm has no artwork for this release. */
  readonly imageUrl?: string;
  /** Whether the user has already "loved" this track on Last.fm — real data from
   * `user.getRecentTracks`'s `extended=1` mode, not a guess. */
  readonly loved: boolean;
}

export interface TopArtist {
  readonly name: string;
  readonly playCount: number;
}

export interface UserProfile {
  readonly username: string;
  readonly realName?: string;
  /** Largest avatar image Last.fm has on file for this user, if any — `undefined`
   * when the account has no photo set (Last.fm returns an empty `#text` for every
   * size in that case). Unlike artist images (see `ArtistInfo` below — Last.fm's
   * `artist.getInfo`/`user.getTopArtists` only ever return the same generic
   * placeholder image for every artist, a known, long-standing limitation of Last.fm's
   * own API, not something fixable client-side), user avatars are real, user-uploaded
   * photos and do come through correctly. */
  readonly avatarUrl?: string;
}

export interface Friend {
  readonly username: string;
  readonly realName?: string;
  /** Same real-photo guarantee as `UserProfile.avatarUrl` (see its docstring) —
   * friends are Last.fm users too, and `user.getFriends` returns each one's own real
   * avatar directly in the same response, no separate per-friend lookup needed. */
  readonly avatarUrl?: string;
}

export interface ArtistInfo {
  readonly name: string;
  readonly bioSummary?: string;
  readonly listeners: number;
  readonly playCount: number;
  // Deliberately no `imageUrl` here (or on `TopArtist`/`SimilarArtist` below): verified
  // live against the real API that `artist.getInfo` and `user.getTopArtists` both
  // return an `image` array, but every size's `#text` points to the exact same generic
  // placeholder graphic (hash `2a96cbd8b46e442fc41c2b86b821562f`) for every artist,
  // regardless of which artist was requested — a known, long-standing issue on
  // Last.fm's side (see e.g. their own API support forum), not something this client
  // can fix. Surfacing that URL would look like a real photo per artist when it's
  // actually the identical image for all of them. Contrast `UserProfile.avatarUrl`
  // above, which comes from `user.getInfo` and *is* a real per-account photo.
}

export interface SimilarArtist {
  readonly name: string;
  readonly match: number;
}

import type {
  ArtistInfo,
  Friend,
  RecentTrack,
  SimilarArtist,
  TopArtist,
  TrackDetail,
  UserProfile,
} from "@lastfm-scrobbler/core";

/**
 * The renderer-facing Last.fm data API the preload script exposes via
 * `contextBridge.exposeInMainWorld("lastfm", ...)`.
 *
 * `getRecentTracks`/`getTopArtists`/`getFriends`/`getUserInfo`/`getArtistInfo`/
 * `getSimilarArtists`/`getTopTags`/`getTrackInfo` are all public, unsigned Last.fm
 * endpoints (no session key involved) — see `main/lastfm/wire-lastfm-data.ts`.
 * `loveTrack`/`unloveTrack`/`addTags` are signed as whichever account is currently
 * active — there's no "which user" parameter, since that's implicit (see
 * `main/lastfm/wire-track-actions.ts`); they reject if no account is logged in.
 *
 * `getArtistInfo`/`getTrackInfo`'s optional `username` follows the same convention as
 * `getRecentTracks`/`getTopArtists`/`getFriends`: the renderer passes whichever
 * account it already has (typically `useAuth()`'s `activeAccount`) explicitly, rather
 * than the main process reaching for its own notion of "the active account" — these
 * are public reads, not session-bound writes, so there's no reason they couldn't be
 * called for an account other than the active one.
 */
export interface LastfmDataApi {
  getRecentTracks(user: string, limit?: number): Promise<readonly RecentTrack[]>;
  getTopArtists(user: string, limit?: number): Promise<readonly TopArtist[]>;
  getFriends(user: string): Promise<readonly Friend[]>;
  getUserInfo(user: string): Promise<UserProfile>;
  getArtistInfo(artist: string, username?: string): Promise<ArtistInfo>;
  getSimilarArtists(artist: string, limit?: number): Promise<readonly SimilarArtist[]>;
  /** Popular community tags for an artist — see `LastfmClient.getTopTags`. */
  getTopTags(artist: string): Promise<readonly string[]>;
  /** Track detail (art, listener/play stats, and — with `username` — the requesting
   * user's own play count and loved status) for a specific artist+track pair. */
  getTrackInfo(artist: string, track: string, username?: string): Promise<TrackDetail>;
  loveTrack(artist: string, track: string): Promise<void>;
  unloveTrack(artist: string, track: string): Promise<void>;
  addTags(artist: string, track: string, tags: readonly string[]): Promise<void>;
}

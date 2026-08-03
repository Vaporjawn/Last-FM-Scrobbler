import type {
  ArtistInfo,
  Friend,
  RecentTrack,
  SimilarArtist,
  TopAlbum,
  TopAlbumsPeriod,
  TopArtist,
  TopArtistsPeriod,
  TopTrack,
  TopTracksPeriod,
  TrackDetail,
  UserProfile,
} from "@lastfm-scrobbler/core";

/**
 * The renderer-facing Last.fm data API the preload script exposes via
 * `contextBridge.exposeInMainWorld("lastfm", ...)`.
 *
 * `getRecentTracks`/`getTopArtists`/`getTopTracks`/`getTopAlbums`/`getFriends`/
 * `getUserInfo`/`getLovedTracksCount`/`getArtistInfo`/`getSimilarArtists`/`getTopTags`/
 * `getTrackInfo` are all public, unsigned Last.fm endpoints (no session key involved) —
 * see `main/lastfm/wire-lastfm-data.ts`.
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
  /** `page` is 1-based (Last.fm's own convention — see
   * `LastfmClient.getRecentTracks`'s docstring) and omitted entirely (defaulting to
   * page 1) when not given, so every call site that only ever wanted the first page
   * simply doesn't pass one — same as before this parameter existed. */
  getRecentTracks(
    user: string,
    limit?: number,
    page?: number,
  ): Promise<readonly RecentTrack[]>;
  /** `period` defaults to Last.fm's own `"overall"` when omitted (see
   * `LastfmClient.getTopArtists`'s docstring) — every call site that wants the
   * all-time ranking simply doesn't pass one, same as before this parameter existed. */
  getTopArtists(
    user: string,
    limit?: number,
    period?: TopArtistsPeriod,
  ): Promise<readonly TopArtist[]>;
  /** Same `period`-defaults-to-Last.fm's-own-"overall" convention as `getTopArtists`
   * above. Deliberately no `imageUrl` per track — see `TopTrack`'s docstring. */
  getTopTracks(
    user: string,
    limit?: number,
    period?: TopTracksPeriod,
  ): Promise<readonly TopTrack[]>;
  /** Same convention as `getTopArtists`/`getTopTracks` above — unlike those two, each
   * result *does* carry a real `imageUrl` (see `TopAlbum`'s docstring). */
  getTopAlbums(
    user: string,
    limit?: number,
    period?: TopAlbumsPeriod,
  ): Promise<readonly TopAlbum[]>;
  getFriends(user: string): Promise<readonly Friend[]>;
  getUserInfo(user: string): Promise<UserProfile>;
  /** Total number of tracks a user has "loved" on Last.fm — see
   * `LastfmClient.getLovedTracksCount`. Kept separate from `getUserInfo`: `user.getInfo`
   * doesn't include this count at all, so it's always a second, independent request
   * either way — call sites that don't need it don't pay for it. */
  getLovedTracksCount(user: string): Promise<number>;
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

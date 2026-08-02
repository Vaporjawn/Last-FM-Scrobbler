import type {
  ArtistInfo,
  Friend,
  RecentTrack,
  SimilarArtist,
  TopArtist,
  UserProfile,
} from "@lastfm-scrobbler/core";

/**
 * The renderer-facing Last.fm data API the preload script exposes via
 * `contextBridge.exposeInMainWorld("lastfm", ...)`.
 *
 * `getRecentTracks`/`getTopArtists`/`getFriends`/`getUserInfo`/`getArtistInfo`/
 * `getSimilarArtists` are all public, unsigned Last.fm endpoints (no session key
 * involved) — see `main/lastfm/wire-lastfm-data.ts`. `loveTrack`/`unloveTrack`/
 * `addTags` are signed as whichever account is currently active — there's no "which
 * user" parameter, since that's implicit (see `main/lastfm/wire-track-actions.ts`);
 * they reject if no account is logged in.
 */
export interface LastfmDataApi {
  getRecentTracks(user: string, limit?: number): Promise<readonly RecentTrack[]>;
  getTopArtists(user: string, limit?: number): Promise<readonly TopArtist[]>;
  getFriends(user: string): Promise<readonly Friend[]>;
  getUserInfo(user: string): Promise<UserProfile>;
  getArtistInfo(artist: string): Promise<ArtistInfo>;
  getSimilarArtists(artist: string, limit?: number): Promise<readonly SimilarArtist[]>;
  loveTrack(artist: string, track: string): Promise<void>;
  unloveTrack(artist: string, track: string): Promise<void>;
  addTags(artist: string, track: string, tags: readonly string[]): Promise<void>;
}

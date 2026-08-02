import type { Friend, RecentTrack, TopArtist } from "@lastfm-scrobbler/core";

/**
 * The renderer-facing read-only Last.fm data API the preload script exposes via
 * `contextBridge.exposeInMainWorld("lastfm", ...)`. These are all public, unsigned
 * Last.fm endpoints (no session key involved) — see `LastfmClient.getRecentTracks`
 * /`getTopArtists`/`getFriends` in packages/core.
 */
export interface LastfmDataApi {
  getRecentTracks(user: string, limit?: number): Promise<readonly RecentTrack[]>;
  getTopArtists(user: string, limit?: number): Promise<readonly TopArtist[]>;
  getFriends(user: string): Promise<readonly Friend[]>;
}

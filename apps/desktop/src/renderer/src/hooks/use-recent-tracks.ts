import type { RecentTrack } from "@lastfm-scrobbler/core";
import { useLastfmFetch } from "./use-lastfm-fetch.js";

export interface RecentTracksState {
  readonly tracks: readonly RecentTrack[];
  readonly loading: boolean;
  readonly error: string | undefined;
}

const EMPTY_TRACKS: readonly RecentTrack[] = [];

/**
 * Fetches `user.getRecentTracks` for `username` via `window.lastfm` (see
 * `src/shared/lastfm-api.ts`). Returns the inert empty state — never throws — when
 * `username` is undefined (no active account yet) or `window.lastfm` isn't present.
 */
export function useRecentTracks(username: string | undefined, limit = 20): RecentTracksState {
  const lastfm = window.lastfm;
  const call =
    username && lastfm ? () => lastfm.getRecentTracks(username, limit) : undefined;
  const { data, loading, error } = useLastfmFetch(EMPTY_TRACKS, call, [username, limit]);
  return { tracks: data, loading, error };
}

import type { TopTrack, TopTracksPeriod } from "@lastfm-scrobbler/core";
import { useLastfmFetch } from "./use-lastfm-fetch.js";

export interface TopTracksState {
  readonly tracks: readonly TopTrack[];
  readonly loading: boolean;
  /** True only while a manual `refetch()` is in flight — see
   * `LastfmFetchState.refreshing`'s docstring. */
  readonly refreshing: boolean;
  readonly error: string | undefined;
  /** Re-fetches `user.getTopTracks` for the same `username`/`limit`/`period` — see
   * `LastfmFetchState.refetch`'s docstring. */
  readonly refetch: () => void;
}

const EMPTY_TRACKS: readonly TopTrack[] = [];

/**
 * Fetches `user.getTopTracks` for `username` via `window.lastfm` (see
 * `src/shared/lastfm-api.ts`). Returns the inert empty state — never throws — when
 * `username` is undefined (no active account yet) or `window.lastfm` isn't present.
 * `period` defaults to Last.fm's own `"overall"` when omitted — see
 * `LastfmDataApi.getTopTracks`'s docstring. Modeled directly on `useTopArtists`.
 */
export function useTopTracks(
  username: string | undefined,
  limit = 10,
  period?: TopTracksPeriod,
): TopTracksState {
  const lastfm = window.lastfm;
  const call =
    username && lastfm ? () => lastfm.getTopTracks(username, limit, period) : undefined;
  const { data, loading, refreshing, error, refetch } = useLastfmFetch(EMPTY_TRACKS, call, [
    username,
    limit,
    period,
  ]);
  return { tracks: data, loading, refreshing, error, refetch };
}

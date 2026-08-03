import type { TopAlbum, TopAlbumsPeriod } from "@lastfm-scrobbler/core";
import { useLastfmFetch } from "./use-lastfm-fetch.js";

export interface TopAlbumsState {
  readonly albums: readonly TopAlbum[];
  readonly loading: boolean;
  /** True only while a manual `refetch()` is in flight — see
   * `LastfmFetchState.refreshing`'s docstring. */
  readonly refreshing: boolean;
  readonly error: string | undefined;
  /** Re-fetches `user.getTopAlbums` for the same `username`/`limit`/`period` — see
   * `LastfmFetchState.refetch`'s docstring. */
  readonly refetch: () => void;
}

const EMPTY_ALBUMS: readonly TopAlbum[] = [];

/**
 * Fetches `user.getTopAlbums` for `username` via `window.lastfm` (see
 * `src/shared/lastfm-api.ts`). Returns the inert empty state — never throws — when
 * `username` is undefined (no active account yet) or `window.lastfm` isn't present.
 * `period` defaults to Last.fm's own `"overall"` when omitted — see
 * `LastfmDataApi.getTopAlbums`'s docstring. Modeled directly on `useTopArtists`.
 */
export function useTopAlbums(
  username: string | undefined,
  limit = 10,
  period?: TopAlbumsPeriod,
): TopAlbumsState {
  const lastfm = window.lastfm;
  const call =
    username && lastfm ? () => lastfm.getTopAlbums(username, limit, period) : undefined;
  const { data, loading, refreshing, error, refetch } = useLastfmFetch(EMPTY_ALBUMS, call, [
    username,
    limit,
    period,
  ]);
  return { albums: data, loading, refreshing, error, refetch };
}

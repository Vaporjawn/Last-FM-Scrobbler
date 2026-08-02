import type { TopArtist, TopArtistsPeriod } from "@lastfm-scrobbler/core";
import { useLastfmFetch } from "./use-lastfm-fetch.js";

export interface TopArtistsState {
  readonly artists: readonly TopArtist[];
  readonly loading: boolean;
  readonly error: string | undefined;
}

const EMPTY_ARTISTS: readonly TopArtist[] = [];

/**
 * Fetches `user.getTopArtists` for `username` via `window.lastfm` (see
 * `src/shared/lastfm-api.ts`). Returns the inert empty state — never throws — when
 * `username` is undefined (no active account yet) or `window.lastfm` isn't present.
 * `period` defaults to Last.fm's own `"overall"` when omitted — see
 * `LastfmDataApi.getTopArtists`'s docstring.
 */
export function useTopArtists(
  username: string | undefined,
  limit = 10,
  period?: TopArtistsPeriod,
): TopArtistsState {
  const lastfm = window.lastfm;
  const call =
    username && lastfm ? () => lastfm.getTopArtists(username, limit, period) : undefined;
  const { data, loading, error } = useLastfmFetch(EMPTY_ARTISTS, call, [username, limit, period]);
  return { artists: data, loading, error };
}

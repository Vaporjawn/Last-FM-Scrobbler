import { useLastfmFetch } from "./use-lastfm-fetch.js";

export interface LovedTracksCountState {
  readonly count: number | undefined;
  readonly loading: boolean;
  /** True only while a manual `refetch()` is in flight — see
   * `LastfmFetchState.refreshing`'s docstring. */
  readonly refreshing: boolean;
  readonly error: string | undefined;
  /** Re-fetches `user.getLovedTracks`'s total count for the same `username` — see
   * `LastfmFetchState.refetch`'s docstring. */
  readonly refetch: () => void;
}

const EMPTY_COUNT: number | undefined = undefined;

/**
 * Fetches `user.getLovedTracks`'s total count for `username` via `window.lastfm` (see
 * `src/shared/lastfm-api.ts`) — `ProfilePage`'s account card. Kept as its own hook
 * rather than folded into `useUserProfile`: it's a genuinely separate API call (see
 * `LastfmClient.getLovedTracksCount`'s docstring), so pages that show a profile but not
 * a loved-tracks count (there are none today, but the separation costs nothing) aren't
 * forced to pay for it. Returns the inert empty state — never throws — when `username`
 * is undefined (no active account yet) or `window.lastfm` isn't present, same
 * convention as `useUserProfile`/`useTopArtists`.
 */
export function useLovedTracksCount(username: string | undefined): LovedTracksCountState {
  const lastfm = window.lastfm;
  const call = username && lastfm ? () => lastfm.getLovedTracksCount(username) : undefined;
  const { data, loading, refreshing, error, refetch } = useLastfmFetch(EMPTY_COUNT, call, [
    username,
  ]);
  return { count: data, loading, refreshing, error, refetch };
}

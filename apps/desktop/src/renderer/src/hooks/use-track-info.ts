import type { TrackDetail } from "@lastfm-scrobbler/core";
import { useLastfmFetch } from "./use-lastfm-fetch.js";

export interface TrackInfoState {
  readonly track: TrackDetail | undefined;
  readonly loading: boolean;
  /** True only while a manual `refetch()` is in flight — see
   * `LastfmFetchState.refreshing`'s docstring. */
  readonly refreshing: boolean;
  readonly error: string | undefined;
  /** Re-fetches `track.getInfo` for the same `artist`/`track`/`username` — see
   * `LastfmFetchState.refetch`'s docstring. */
  readonly refetch: () => void;
}

const EMPTY_TRACK: TrackDetail | undefined = undefined;

/**
 * Fetches `track.getInfo` for an artist+track pair via `window.lastfm` (see
 * `src/shared/lastfm-api.ts`) — ScrobbleDetailPage's hero section (art, listener/play
 * stats, this account's own play count when `username` is given). Public, unsigned
 * endpoint — works regardless of login. Returns the inert empty state — never throws
 * — when `artist`/`track` are undefined or `window.lastfm` isn't present.
 *
 * @param username When given, `track.userPlayCount`/`loved` are populated with this
 * user's own data for the track (see `getTrackInfo`'s docstring).
 */
export function useTrackInfo(
  artist: string | undefined,
  track: string | undefined,
  username?: string,
): TrackInfoState {
  const lastfm = window.lastfm;
  const call =
    artist && track && lastfm ? () => lastfm.getTrackInfo(artist, track, username) : undefined;
  const { data, loading, refreshing, error, refetch } = useLastfmFetch(EMPTY_TRACK, call, [
    artist,
    track,
    username,
  ]);
  return { track: data, loading, refreshing, error, refetch };
}

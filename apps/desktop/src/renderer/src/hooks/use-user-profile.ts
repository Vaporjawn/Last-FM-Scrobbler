import type { UserProfile } from "@lastfm-scrobbler/core";
import { useLastfmFetch } from "./use-lastfm-fetch.js";

export interface UserProfileState {
  readonly profile: UserProfile | undefined;
  readonly loading: boolean;
  /** True only while a manual `refetch()` is in flight — see
   * `LastfmFetchState.refreshing`'s docstring. */
  readonly refreshing: boolean;
  readonly error: string | undefined;
  /** Re-fetches `user.getInfo` for the same `username` — see
   * `LastfmFetchState.refetch`'s docstring. */
  readonly refetch: () => void;
}

const EMPTY_PROFILE: UserProfile | undefined = undefined;

/**
 * Fetches `user.getInfo` for `username` via `window.lastfm` (see
 * `src/shared/lastfm-api.ts`) — real name and avatar photo, primarily for
 * `ProfilePage`'s account card. Returns the inert empty state — never throws — when
 * `username` is undefined (no active account yet) or `window.lastfm` isn't present,
 * same convention as `useTopArtists`.
 */
export function useUserProfile(username: string | undefined): UserProfileState {
  const lastfm = window.lastfm;
  const call = username && lastfm ? () => lastfm.getUserInfo(username) : undefined;
  const { data, loading, refreshing, error, refetch } = useLastfmFetch(EMPTY_PROFILE, call, [
    username,
  ]);
  return { profile: data, loading, refreshing, error, refetch };
}

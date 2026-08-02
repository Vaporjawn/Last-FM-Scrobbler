import type { UserProfile } from "@lastfm-scrobbler/core";
import { useLastfmFetch } from "./use-lastfm-fetch.js";

export interface UserProfileState {
  readonly profile: UserProfile | undefined;
  readonly loading: boolean;
  readonly error: string | undefined;
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
  const { data, loading, error } = useLastfmFetch(EMPTY_PROFILE, call, [username]);
  return { profile: data, loading, error };
}

import type { Friend } from "@lastfm-scrobbler/core";
import { useLastfmFetch } from "./use-lastfm-fetch.js";

export interface FriendsState {
  readonly friends: readonly Friend[];
  readonly loading: boolean;
  readonly error: string | undefined;
}

const EMPTY_FRIENDS: readonly Friend[] = [];

/**
 * Fetches `user.getFriends` for `username` via `window.lastfm` (see
 * `src/shared/lastfm-api.ts`). Returns the inert empty state — never throws — when
 * `username` is undefined (no active account yet) or `window.lastfm` isn't present.
 */
export function useFriends(username: string | undefined): FriendsState {
  const lastfm = window.lastfm;
  const call = username && lastfm ? () => lastfm.getFriends(username) : undefined;
  const { data, loading, error } = useLastfmFetch(EMPTY_FRIENDS, call, [username]);
  return { friends: data, loading, error };
}

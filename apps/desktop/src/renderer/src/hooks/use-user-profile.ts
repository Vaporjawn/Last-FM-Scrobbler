import { useEffect, useState } from "react";
import type { UserProfile } from "@lastfm-scrobbler/core";

export interface UserProfileState {
  readonly profile: UserProfile | undefined;
  readonly loading: boolean;
  readonly error: string | undefined;
}

const EMPTY: UserProfileState = { profile: undefined, loading: false, error: undefined };

/**
 * Fetches `user.getInfo` for `username` via `window.lastfm` (see
 * `src/shared/lastfm-api.ts`) — real name and avatar photo, primarily for
 * `ProfilePage`'s account card. Returns the inert empty state — never throws — when
 * `username` is undefined (no active account yet) or `window.lastfm` isn't present,
 * same convention as `useTopArtists`.
 */
export function useUserProfile(username: string | undefined): UserProfileState {
  const [state, setState] = useState<UserProfileState>(EMPTY);

  useEffect(() => {
    if (!username || !window.lastfm) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: undefined }));

    window.lastfm
      .getUserInfo(username)
      .then((profile) => {
        if (!cancelled) {
          setState({ profile, loading: false, error: undefined });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            profile: undefined,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  return state;
}

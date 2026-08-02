import { useEffect, useState } from "react";
import type { Friend } from "@lastfm-scrobbler/core";

export interface FriendsState {
  readonly friends: readonly Friend[];
  readonly loading: boolean;
  readonly error: string | undefined;
}

const EMPTY: FriendsState = { friends: [], loading: false, error: undefined };

/**
 * Fetches `user.getFriends` for `username` via `window.lastfm` (see
 * `src/shared/lastfm-api.ts`). Returns the inert empty state — never throws — when
 * `username` is undefined (no active account yet) or `window.lastfm` isn't present.
 */
export function useFriends(username: string | undefined): FriendsState {
  const [state, setState] = useState<FriendsState>(EMPTY);

  useEffect(() => {
    if (!username || !window.lastfm) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: undefined }));

    window.lastfm
      .getFriends(username)
      .then((friends) => {
        if (!cancelled) {
          setState({ friends, loading: false, error: undefined });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            friends: [],
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

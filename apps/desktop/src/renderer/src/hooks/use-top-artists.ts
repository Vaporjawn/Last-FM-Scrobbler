import { useEffect, useState } from "react";
import type { TopArtist } from "@lastfm-scrobbler/core";

export interface TopArtistsState {
  readonly artists: readonly TopArtist[];
  readonly loading: boolean;
  readonly error: string | undefined;
}

const EMPTY: TopArtistsState = { artists: [], loading: false, error: undefined };

/**
 * Fetches `user.getTopArtists` for `username` via `window.lastfm` (see
 * `src/shared/lastfm-api.ts`). Returns the inert empty state — never throws — when
 * `username` is undefined (no active account yet) or `window.lastfm` isn't present.
 */
export function useTopArtists(username: string | undefined, limit = 10): TopArtistsState {
  const [state, setState] = useState<TopArtistsState>(EMPTY);

  useEffect(() => {
    if (!username || !window.lastfm) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: undefined }));

    window.lastfm
      .getTopArtists(username, limit)
      .then((artists) => {
        if (!cancelled) {
          setState({ artists, loading: false, error: undefined });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            artists: [],
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [username, limit]);

  return state;
}

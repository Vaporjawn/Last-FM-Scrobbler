import { useEffect, useState } from "react";
import type { RecentTrack } from "@lastfm-scrobbler/core";

export interface RecentTracksState {
  readonly tracks: readonly RecentTrack[];
  readonly loading: boolean;
  readonly error: string | undefined;
}

const EMPTY: RecentTracksState = { tracks: [], loading: false, error: undefined };

/**
 * Fetches `user.getRecentTracks` for `username` via `window.lastfm` (see
 * `src/shared/lastfm-api.ts`). Returns the inert empty state — never throws — when
 * `username` is undefined (no active account yet) or `window.lastfm` isn't present.
 */
export function useRecentTracks(username: string | undefined, limit = 20): RecentTracksState {
  const [state, setState] = useState<RecentTracksState>(EMPTY);

  useEffect(() => {
    if (!username || !window.lastfm) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: undefined }));

    window.lastfm
      .getRecentTracks(username, limit)
      .then((tracks) => {
        if (!cancelled) {
          setState({ tracks, loading: false, error: undefined });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            tracks: [],
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

import { useEffect, useState } from "react";
import type { TrackDetail } from "@lastfm-scrobbler/core";

export interface TrackInfoState {
  readonly track: TrackDetail | undefined;
  readonly loading: boolean;
  readonly error: string | undefined;
}

const EMPTY: TrackInfoState = { track: undefined, loading: false, error: undefined };

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
  const [state, setState] = useState<TrackInfoState>(EMPTY);

  useEffect(() => {
    if (!artist || !track || !window.lastfm) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: undefined }));

    window.lastfm
      .getTrackInfo(artist, track, username)
      .then((result) => {
        if (!cancelled) {
          setState({ track: result, loading: false, error: undefined });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            track: undefined,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [artist, track, username]);

  return state;
}

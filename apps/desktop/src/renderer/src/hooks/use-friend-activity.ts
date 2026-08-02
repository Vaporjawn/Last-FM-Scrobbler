import { useEffect, useState } from "react";
import type { RecentTrack } from "@lastfm-scrobbler/core";

export interface FriendActivityState {
  /** The friend's single most recent (or currently playing) track — `undefined`
   * while loading, on fetch failure, or if they have no scrobble history at all. */
  readonly track: RecentTrack | undefined;
  readonly loading: boolean;
}

const EMPTY: FriendActivityState = { track: undefined, loading: false };

/**
 * Fetches a single friend's most recent activity (`user.getRecentTracks` capped at
 * one result) for `FriendsPage`'s per-row activity line — see `FriendListItem.tsx`.
 * Last.fm has no bulk "recent tracks for these N users" endpoint, so this is called
 * once per friend row; each row fetches and fails independently, so one friend's
 * private/empty history never blocks or breaks the rest of the list. Deliberately
 * swallows fetch errors into the same "nothing to show" state as "no history" rather
 * than surfacing a per-row error — this is a nice-to-have enrichment, not core data,
 * and a wall of small red error lines next to friends' names would be worse than
 * just showing no activity line for those rows.
 */
export function useFriendActivity(username: string | undefined): FriendActivityState {
  const [state, setState] = useState<FriendActivityState>(EMPTY);

  useEffect(() => {
    if (!username || !window.lastfm) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState({ track: undefined, loading: true });

    window.lastfm
      .getRecentTracks(username, 1)
      .then((tracks) => {
        if (!cancelled) {
          setState({ track: tracks[0], loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ track: undefined, loading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  return state;
}

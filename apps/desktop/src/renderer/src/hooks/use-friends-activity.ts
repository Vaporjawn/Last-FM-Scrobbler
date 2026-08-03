import { useCallback, useEffect, useState } from "react";
import type { FriendActivityState } from "./friend-activity-state.js";

export type FriendsActivityMap = Readonly<Record<string, FriendActivityState>>;

export interface FriendsActivityResult {
  readonly activityByUsername: FriendsActivityMap;
  /** Re-fetches every given friend's most recent activity from scratch — every entry
   * goes back to `LOADING` first, same as the initial fetch, rather than staying on
   * screen while stale (unlike `useLastfmFetch`'s `refetch`, which keeps showing old
   * data during a refresh): with up to 50 independent per-friend requests in flight,
   * "loading" is a per-row state each `FriendListItem` already renders inline, not a
   * whole-page spinner, so there's no blank-flash concern here to avoid. */
  readonly refetch: () => void;
}

const LOADING: FriendActivityState = { track: undefined, loading: true, error: undefined };

/**
 * Fetches every given friend's most recent activity (`user.getRecentTracks` capped
 * at one result each) — the page-level counterpart `FriendsPage` needs so it can sort
 * "scrobbling now" friends to the top and filter the list by search text without
 * losing visibility into who's currently active. Last.fm has no bulk "recent tracks
 * for these N users" endpoint, so this fires one request per username, same as
 * before — but each one now updates this hook's returned map *as it individually
 * settles*, not via `Promise.all` (which would hold every friend's activity back
 * until the single slowest request finished). One friend's slow or failed fetch
 * still never blocks or blanks the rest — that property carries over unchanged from
 * the row-level version this replaces, just implemented at the page level instead of
 * inside each row, since sorting-by-activity needs that visibility above individual
 * rows.
 */
export function useFriendsActivity(usernames: readonly string[]): FriendsActivityResult {
  const [activityByUsername, setActivityByUsername] = useState<Record<string, FriendActivityState>>(
    {},
  );
  // A stable primitive key, not the array reference itself — `usernames` is a new
  // array every render (e.g. FriendsPage re-renders on every keystroke in its search
  // box), which would otherwise re-run this effect — and re-fetch everyone's
  // activity — on every keystroke instead of only when the actual friend list changes.
  const usernamesKey = usernames.join(" ");
  // Bumped by `refetch()` to force the effect below to re-run against the same
  // `usernamesKey` — the same "reload token" trick `useLastfmFetch` uses internally
  // (there, via its own generation ref), needed here because this effect otherwise
  // only re-runs when its real inputs (the friend list) change.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!window.lastfm || usernames.length === 0) {
      setActivityByUsername({});
      return;
    }
    let cancelled = false;

    setActivityByUsername(Object.fromEntries(usernames.map((username) => [username, LOADING])));

    usernames.forEach((username) => {
      window.lastfm
        ?.getRecentTracks(username, 1)
        .then((tracks) => {
          if (!cancelled) {
            setActivityByUsername((previous) => ({
              ...previous,
              [username]: { track: tracks[0], loading: false, error: undefined },
            }));
          }
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`useFriendsActivity: failed to load activity for "${username}": ${message}`);
          if (!cancelled) {
            setActivityByUsername((previous) => ({
              ...previous,
              [username]: { track: undefined, loading: false, error: message },
            }));
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [usernamesKey, reloadToken]);

  const refetch = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { activityByUsername, refetch };
}

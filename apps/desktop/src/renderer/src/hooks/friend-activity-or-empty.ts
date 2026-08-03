import type { FriendActivityState } from "./friend-activity-state.js";
import type { FriendsActivityMap } from "./use-friends-activity.js";

const EMPTY: FriendActivityState = { track: undefined, loading: false, error: undefined };

/** `useFriendsActivity`'s inert per-friend default — same shape `EMPTY` reset to
 * whenever a username has no entry yet (e.g. this render's friend list includes
 * someone the fetch effect hasn't started for). Exported so callers reading the map
 * (`FriendsPage`) don't need to know this hook's internal default shape. */
export function friendActivityOrEmpty(
  activityByUsername: FriendsActivityMap,
  username: string,
): FriendActivityState {
  return activityByUsername[username] ?? EMPTY;
}

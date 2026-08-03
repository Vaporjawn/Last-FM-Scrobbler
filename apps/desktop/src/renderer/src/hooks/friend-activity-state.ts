import type { RecentTrack } from "@lastfm-scrobbler/core";

/** One friend's activity as tracked by `useFriendsActivity`. */
export interface FriendActivityState {
  /** The friend's single most recent (or currently playing) track — `undefined`
   * while loading, on fetch failure, or if they have no scrobble history at all
   * (`error` distinguishes the second case from the third and the first). */
  readonly track: RecentTrack | undefined;
  readonly loading: boolean;
  /** Set only when the fetch itself failed — `undefined` for "still loading" and for
   * "loaded successfully but this friend has no scrobble history", which look the
   * same to a caller that only checks `track`. Not surfaced in `FriendListItem`'s UI
   * (a wall of small red errors next to friends' names would be worse than showing
   * no activity line for those rows) — logged via `console.warn` instead, and kept
   * here so a caller that *does* want to react to it (e.g. to distinguish "empty"
   * from "broke" for sorting/diagnostics) can. */
  readonly error: string | undefined;
}

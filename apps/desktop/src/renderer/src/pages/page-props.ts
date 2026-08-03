import type { RecentTrack } from "@lastfm-scrobbler/core";

/**
 * Common props `App.tsx` passes to every view (see `PAGES` there). Pages that don't
 * need a given callback simply don't destructure it; a component that takes fewer
 * props (including zero) is still assignable to this shape.
 */
export interface PageProps {
  /** Switches the active view to Settings — used by pages that need an active
   * Last.fm account before they have anything to show (see `LoginPrompt`). */
  readonly onNavigateToSettings: () => void;
  /** Switches the active view to Profile — used by `SettingsPage` right after a
   * successful login, so the user immediately sees confirmation of who they're now
   * logged in as rather than staying on a plain account-picker list. Optional (unlike
   * `onNavigateToSettings` above) so pages that don't call it don't need to thread
   * it through their own test fakes. */
  readonly onNavigateToProfile?: () => void;
  /** Opens `ScrobbleDetailPage` for a clicked scrobble — `ScrobblesPage`'s own list
   * and `FriendsPage`'s per-friend activity card both offer something to click; other
   * pages simply don't destructure this. `App.tsx` holds "which track" as separate
   * state from `activeView` (see there) rather than folding this into the `ViewId`
   * union, since a detail view isn't a sidebar destination — it's a drill-down that
   * always returns to whichever page opened it. */
  readonly onSelectScrobble?: (track: RecentTrack) => void;
  /** Opens `ProfilePage` for a clicked friend — `FriendsPage`'s own list is the only
   * source today (see `FriendListItem.onSelectFriend`). Mirrors `onSelectScrobble`
   * above: `App.tsx` holds "which friend" as separate state from `activeView` for the
   * same reason a scrobble's detail view isn't a sidebar destination — it's a
   * drill-down that always returns to whichever page opened it. */
  readonly onSelectFriend?: (username: string) => void;
}

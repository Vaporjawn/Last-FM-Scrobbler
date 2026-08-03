import type { JSX } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import ListItem from "@mui/material/ListItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Friend, RecentTrack } from "@lastfm-scrobbler/core";
import type { FriendActivityState } from "../hooks/friend-activity-state.js";
import { formatRealNameAndLocation } from "../utils/format-real-name-and-location.js";
import { PlaybackStatusChip } from "./shared/PlaybackStatusChip.js";
import { SubscriberAvatar } from "./shared/SubscriberAvatar.js";
import { TrackArtworkAvatar } from "./shared/TrackArtworkAvatar.js";

/** Both halves of the card share one avatar size — deliberately equal, not the
 * friend-bigger/track-smaller split this component used before it became a single
 * side-by-side card: with the two sitting as visual peers in the same row rather than
 * a primary row with a secondary card stacked underneath it, matching sizes is what
 * actually reads as one balanced card instead of two mismatched halves glued
 * together. */
const AVATAR_SIZE = 48;

/** Fixed pixel width of the friend avatar+text column — the first of the two column
 * tracks `FriendsPage` declares on its outer `List` grid (see that file), which every
 * row's `Paper` below shares via `gridTemplateColumns: "subgrid"` rather than each
 * independently redeclaring its own `190px 1fr`. `subgrid` (not just matching
 * declared widths per row) is what actually guarantees the track-art column starts at
 * the identical x position on every row, regardless of username/real-name/location
 * length *or* whether the row next to it happens to have any activity — a shared
 * track is authoritative in a way N independent grids that merely intend to agree
 * can't quite promise. Exported so `FriendsPage` and this file can't drift out of
 * sync on the value. */
export const FRIEND_COLUMN_WIDTH = 190;

export interface FriendListItemProps {
  readonly friend: Friend;
  /** This friend's most recent activity — fetched by `FriendsPage` (via
   * `useFriendsActivity`) rather than by this component itself. That's a deliberate
   * change from this component's first version, which fetched its own activity
   * per-row: `FriendsPage` needs visibility into every friend's `nowPlaying` status
   * to sort "scrobbling now" friends to the top, which isn't possible if that data
   * lives inside each row instead of above them. Renders nothing extra while
   * loading, on failure, or if the friend has no scrobble history — `error` is
   * intentionally not surfaced here (see `FriendActivityState`'s docstring). */
  readonly activity: FriendActivityState;
  /** Opens `ScrobbleDetailPage` for this friend's activity track when given — same
   * prop shape and same "row becomes a real button" treatment as
   * `ScrobbleListItem.onSelect` (see there), reusing that page for a friend's track
   * instead of building a second one. Omitted entirely (activity card stays
   * non-interactive) by any caller that doesn't have anywhere to navigate to, and
   * has no effect when there's no `activity.track` to select in the first place. */
  readonly onSelectTrack?: (track: RecentTrack) => void;
  /** Opens `ProfilePage` for this friend when given — wired only on the avatar/name
   * row above (not the whole `ListItem`, and not the activity card, which keeps its
   * own independent `onSelectTrack` click-through). Omitted entirely (the row stays
   * non-interactive) by any caller with nowhere to navigate to, same convention as
   * `onSelectTrack`. */
  readonly onSelectFriend?: (username: string) => void;
}

/**
 * One row of `FriendsPage`'s list, rendered as a single outlined `Paper` card split
 * into two equal-weight halves side by side, both following the exact same
 * avatar-plus-two-line-text shape so the card reads as one balanced unit rather than
 * two mismatched pieces glued together: the friend's real Last.fm avatar
 * (`friend.avatarUrl` — comes directly from `user.getFriends`, no separate lookup
 * needed; `Avatar` falls back to a letter automatically when it's absent, same as
 * `ProfilePage`'s account card) plus their username and real name/location (see
 * `formatRealNameAndLocation`) on the left; their most recent activity — passed in via
 * `activity`, see that prop's docstring for why this component doesn't fetch it
 * itself — on the right, when there is any: real album art (`track.imageUrl`, the same
 * real-image field `ScrobbleListItem` already renders for scrobble history, falling
 * back to a note/play icon the same way) plus the track title and, on the line below
 * it, the artist and the same `PlaybackStatusChip` pill `ScrobbleListItem` uses for
 * "Now Playing"/when it was last scrobbled — the app-wide standard for that fact
 * everywhere it appears, not a bespoke text-only rendering local to this component.
 * The two halves are independently clickable: the avatar/name half through to the
 * friend's own `ProfilePage` when `onSelectFriend` is given, the activity half through
 * to that track's `ScrobbleDetailPage` when `onSelectTrack` is given — since the two
 * lead to different destinations; either or both can be omitted to leave that half
 * non-interactive.
 */
export function FriendListItem({
  friend,
  activity,
  onSelectTrack,
  onSelectFriend,
}: FriendListItemProps): JSX.Element {
  const { track } = activity;

  const secondaryLine = formatRealNameAndLocation(friend);

  return (
    // `display: contents` makes this `<li>`'s own box (and the padding/divider it
    // used to carry directly) disappear from layout entirely — its child (the
    // `Paper` below) becomes a *direct* grid item of `FriendsPage`'s outer `List`
    // grid, which is what lets that `Paper` use `gridTemplateColumns: "subgrid"` at
    // all (subgrid can only inherit tracks from the grid it's a direct child of; an
    // intervening non-grid `ListItem` box would block that). Row spacing moves to
    // the outer grid's `rowGap` instead of this element's own `py`/`divider` — see
    // `FriendsPage.tsx`.
    <ListItem sx={{ display: "contents" }}>
      {/* One shared card for both halves, each the same avatar-plus-two-line-text
          shape — see this component's own docstring for why. A real CSS Grid
          *subgrid*, not each row independently declaring its own `190px 1fr`: every
          row's two columns are the *same* two column tracks, computed once by
          `FriendsPage`'s outer grid, not N separately-computed grids that merely
          intend to agree on `FRIEND_COLUMN_WIDTH`. That distinction is exactly what
          closes the gap independent per-row grids left open — matching declared
          widths is still an agreement between N independent layout computations, and
          in practice that agreement visibly drifted row to row; a shared track can't
          drift from itself. `minWidth: 0` on the friend column below is still a
          defensive habit worth keeping (content overflowing its cell is a separate
          failure mode subgrid doesn't prevent on its own), just no longer what the
          cross-row alignment itself depends on.

          The two columns are reserved unconditionally — not conditional on whether
          this particular friend has a `track` to show, the way an earlier version had
          it (full-width single column when there's no activity). That reads fine for
          any one row in isolation, but across a whole Friends list (`FriendsPage`
          renders one of these per friend, up to 50), some friends inevitably have no
          recent scrobble at all; reserving the same two columns unconditionally means
          the friend column's left edge, width, and the track column's start position
          are identical on every single row, whether or not that particular friend has
          anything to show on the right. */}
      <Paper
        variant="outlined"
        sx={{
          gridColumn: "1 / -1",
          display: "grid",
          gridTemplateColumns: "subgrid",
          alignItems: "center",
          gap: 1.75,
          p: 1.25,
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          {...(onSelectFriend
            ? {
                component: ButtonBase,
                onClick: () => {
                  onSelectFriend(friend.username);
                },
                "aria-label": `View ${friend.username}'s profile`,
              }
            : {})}
          sx={{
            alignItems: "center",
            minWidth: 0,
            overflow: "hidden",
            ...(onSelectFriend ? { textAlign: "left", cursor: "pointer" } : {}),
          }}
        >
          <SubscriberAvatar
            src={friend.avatarUrl}
            alt={friend.username}
            size={AVATAR_SIZE}
            fallbackInitial={friend.username.slice(0, 1).toUpperCase()}
            isSubscriber={friend.isSubscriber}
            bgcolor="action.selected"
            color="text.secondary"
            flexShrink
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
              {friend.username}
            </Typography>
            {secondaryLine ? (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                {secondaryLine}
              </Typography>
            ) : null}
          </Box>
        </Stack>

        {track ? (
          <Box
            {...(onSelectTrack
              ? {
                  component: ButtonBase,
                  onClick: () => {
                    onSelectTrack(track);
                  },
                  "aria-label": `View details for ${track.track}`,
                }
              : {})}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              minWidth: 0,
              textAlign: "left",
              ...(onSelectTrack ? { cursor: "pointer" } : {}),
            }}
          >
            <TrackArtworkAvatar
              imageUrl={track.imageUrl}
              title={track.track}
              nowPlaying={track.nowPlaying}
              size={AVATAR_SIZE}
              flexShrink
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{ fontWeight: 600, ...(track.nowPlaying ? { color: "primary.main" } : {}) }}
              >
                {track.track}
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
                {/* The artist name truncates first (minWidth: 0) if space is tight —
                    the chip's own content (a live "Scrobbling now" or a specific
                    timestamp) is the more load-bearing of the two here, so it keeps
                    its full width rather than being squeezed by a long artist name. */}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ minWidth: 0 }}
                >
                  {track.artist}
                </Typography>
                <PlaybackStatusChip
                  nowPlaying={track.nowPlaying}
                  timestamp={track.timestamp}
                  nowPlayingLabel="Scrobbling now"
                  sx={{ flexShrink: 0 }}
                />
              </Stack>
            </Box>
          </Box>
        ) : null}
      </Paper>
    </ListItem>
  );
}

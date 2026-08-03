import type { JSX } from "react";
import StarIcon from "@mui/icons-material/Star";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import ListItem from "@mui/material/ListItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Friend, RecentTrack } from "@lastfm-scrobbler/core";
import type { FriendActivityState } from "../hooks/use-friends-activity.js";
import { ScrobblingIndicator } from "./ScrobblingIndicator.js";
import { TrackArtworkAvatar } from "./shared/TrackArtworkAvatar.js";

/** Both halves of the card share one avatar size — deliberately equal, not the
 * friend-bigger/track-smaller split this component used before it became a single
 * side-by-side card: with the two sitting as visual peers in the same row rather than
 * a primary row with a secondary card stacked underneath it, matching sizes is what
 * actually reads as one balanced card instead of two mismatched halves glued
 * together. */
const AVATAR_SIZE = 48;

/** Fixed pixel width of the friend avatar+text column, applied unconditionally on
 * every row (whether or not that friend has a track to show), so the track-art column
 * starts at the exact same x position on every row regardless of username/real-name/
 * location length *or* whether the row next to it happens to have any activity — see
 * the `gridTemplateColumns` comment below for why this is a CSS Grid column now, not a
 * flex item's `width`, and why it's unconditional. */
const FRIEND_COLUMN_WIDTH = 190;

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

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
 * `formatSecondaryLine`) on the left; their most recent activity — passed in via
 * `activity`, see that prop's docstring for why this component doesn't fetch it
 * itself — on the right, when there is any: real album art (`track.imageUrl`, the same
 * real-image field `ScrobbleListItem` already renders for scrobble history, falling
 * back to a note/play icon the same way) plus the track title and, on the line below
 * it, the artist and either a live equalizer indicator (`ScrobblingIndicator`, while
 * `track.nowPlaying`) or when it was last scrobbled — deliberately not the padded
 * `PlaybackStatusChip` pill `ScrobbleListItem` uses: with two avatar-and-text blocks
 * already sharing one row, a full chip left almost no width for the track title
 * itself, forcing it onto its own cramped, heavily-truncated line under the chip.
 * The two halves are independently clickable: the avatar/name half through to the
 * friend's own `ProfilePage` when `onSelectFriend` is given, the activity half through
 * to that track's `ScrobbleDetailPage` when `onSelectTrack` is given — since the two
 * lead to different destinations; either or both can be omitted to leave that half
 * non-interactive.
 */
/** Combines `realName` and `location` onto ListItemText's one `secondary` line
 * ("Real Name · Location"), rather than adding a third text row for a single extra
 * field — falls back to whichever one is actually present, and to `undefined` (no
 * secondary line at all, matching this component's existing behavior) when neither
 * is. */
function formatSecondaryLine(friend: Friend): string | undefined {
  const parts = [friend.realName, friend.location].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function FriendListItem({
  friend,
  activity,
  onSelectTrack,
  onSelectFriend,
}: FriendListItemProps): JSX.Element {
  const { track } = activity;

  const secondaryLine = formatSecondaryLine(friend);

  return (
    <ListItem divider sx={{ py: 1 }}>
      {/* One shared card for both halves, each the same avatar-plus-two-line-text
          shape — see this component's own docstring for why. A real two-column CSS
          Grid, not a flex row with a fixed-`width` child: grid column tracks are
          authoritative regardless of a child's content, so the track-art column is
          guaranteed to start at the same x position on every row. A flex row with
          `width: 190` on the friend half almost gets there, but a flex item's
          rendered size can still be pushed wider than its declared `width` by content
          deep in its subtree unless *every* level between it and that content is
          `minWidth: 0`-guarded — miss one, and that row's avatar/track-art column
          visibly drifts left/right depending on whoever's username happened to be on
          it (exactly the "uneven cards" bug this replaced). Grid doesn't have that
          failure mode: the template's column boundary holds even if a child overflows
          it, so `minWidth: 0` on the friend column below is a defensive habit, not
          something the alignment itself depends on.

          The two columns are a *constant* `${FRIEND_COLUMN_WIDTH}px 1fr` — not
          conditional on whether this particular friend has a `track` to show, the way
          an earlier version had it (full-width single column when there's no
          activity). That reads fine for any one row in isolation, but across a whole
          Friends list (`FriendsPage` renders one of these per friend, up to 50), some
          friends inevitably have no recent scrobble at all — their row's friend
          column would then be a completely different width than every neighboring
          row's, which is exactly the kind of "cards don't line up" unevenness this is
          trying to eliminate, just moved from *within* a row to *across* rows instead
          of actually fixed. Reserving the same two columns unconditionally means the
          friend column's left edge, width, and the track column's start position are
          identical on every single row, whether or not that particular friend has
          anything to show on the right. */}
      <Paper
        variant="outlined"
        sx={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: `${FRIEND_COLUMN_WIDTH}px 1fr`,
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
          <Box sx={{ position: "relative", flexShrink: 0 }}>
            <Avatar
              src={friend.avatarUrl}
              alt={friend.username}
              sx={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                bgcolor: "action.selected",
                color: "text.secondary",
              }}
            >
              {friend.username.slice(0, 1).toUpperCase()}
            </Avatar>
            {friend.isSubscriber ? (
              <StarIcon
                titleAccess="Last.fm Pro subscriber"
                sx={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  fontSize: 14,
                  color: "warning.main",
                  bgcolor: "background.paper",
                  borderRadius: "50%",
                  p: "1px",
                }}
              />
            ) : null}
          </Box>
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
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", minWidth: 0 }}>
                {track.nowPlaying ? (
                  <Box
                    role="status"
                    aria-label="Scrobbling now"
                    sx={{ color: "primary.main", display: "inline-flex" }}
                  >
                    <ScrobblingIndicator size={11} />
                  </Box>
                ) : null}
                <Typography variant="caption" color="text.secondary" noWrap>
                  {track.nowPlaying
                    ? track.artist
                    : track.timestamp !== undefined
                      ? `${track.artist} · ${formatTimestamp(track.timestamp)}`
                      : track.artist}
                </Typography>
              </Stack>
            </Box>
          </Box>
        ) : null}
      </Paper>
    </ListItem>
  );
}

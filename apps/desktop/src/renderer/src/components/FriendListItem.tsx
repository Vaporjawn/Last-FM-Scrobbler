import type { JSX } from "react";
import StarIcon from "@mui/icons-material/Star";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Divider from "@mui/material/Divider";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Friend, RecentTrack } from "@lastfm-scrobbler/core";
import type { FriendActivityState } from "../hooks/use-friends-activity.js";
import { PlaybackStatusChip } from "./shared/PlaybackStatusChip.js";
import { TrackArtworkAvatar } from "./shared/TrackArtworkAvatar.js";

/** Friend avatar size — bumped up from MUI's 40px default so real Last.fm photos
 * actually read at list scale; matches `ScrobbleListItem`'s row avatar for a
 * consistent list-avatar size across the app. The activity half's own artwork stays a
 * step smaller (see `ACTIVITY_AVATAR_SIZE` below) to keep the visual hierarchy — the
 * friend is the primary subject of the card, their current track a secondary detail
 * sitting beside them, not competing for the same visual weight. */
const AVATAR_SIZE = 56;
const ACTIVITY_AVATAR_SIZE = 48;

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
 * into two halves side by side: the friend's real Last.fm avatar (`friend.avatarUrl` —
 * comes directly from `user.getFriends`, no separate lookup needed; `Avatar` falls
 * back to a letter automatically when it's absent, same as `ProfilePage`'s account
 * card), a small gold star under the avatar for a Last.fm Pro subscriber
 * (`friend.isSubscriber` — also parsed directly out of the same `user.getFriends`
 * response, no separate lookup), and their real name and/or self-reported location
 * (see `formatSecondaryLine` — either, both, or neither, same "no lookup needed"
 * source) on the left; their most recent activity — passed in via `activity`, see that
 * prop's docstring for why this component doesn't fetch it itself — on the right, past
 * a vertical `Divider`, when there is any (real album art via `track.imageUrl`, the
 * same real-image field `ScrobbleListItem` already renders for scrobble history,
 * falling back to a note/play icon the same way, plus the status chip/timestamp and
 * track/artist text). The two halves are independently clickable: the avatar/name half
 * through to the friend's own `ProfilePage` when `onSelectFriend` is given, the
 * activity half through to that track's `ScrobbleDetailPage` when `onSelectTrack` is
 * given — since the two lead to different destinations; either or both can be omitted
 * to leave that half non-interactive.
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

  return (
    <ListItem divider sx={{ py: 1 }}>
      {/* One shared card for both halves — replaces the previous friend-row-with-a-
          separate-activity-card-stacked-underneath layout. `flexShrink: 0` on the
          friend half keeps the avatar/name from being squeezed as the window narrows;
          `minWidth: 0` + `flex: 1` on the activity half is what lets its `noWrap`
          track title actually truncate with an ellipsis instead of overflowing. */}
      <Paper
        variant="outlined"
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          p: 1.25,
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
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
            flexShrink: 0,
            ...(onSelectFriend ? { textAlign: "left", cursor: "pointer" } : {}),
          }}
        >
          <Stack spacing={0.25} sx={{ alignItems: "center", flexShrink: 0 }}>
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
                sx={{ fontSize: 16, color: "warning.main" }}
              />
            ) : null}
          </Stack>
          <ListItemText
            primary={friend.username}
            secondary={formatSecondaryLine(friend)}
            sx={{ my: 0, maxWidth: 160 }}
            slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
          />
        </Stack>

        {track ? (
          <>
            <Divider orientation="vertical" flexItem />
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
                flex: 1,
                minWidth: 0,
                textAlign: "left",
                ...(onSelectTrack ? { cursor: "pointer" } : {}),
              }}
            >
              <TrackArtworkAvatar
                imageUrl={track.imageUrl}
                title={track.track}
                nowPlaying={track.nowPlaying}
                size={ACTIVITY_AVATAR_SIZE}
                flexShrink
              />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <PlaybackStatusChip
                  nowPlaying={track.nowPlaying}
                  timestamp={track.timestamp}
                  nowPlayingLabel="Scrobbling now"
                  sx={{ mb: 0.5 }}
                />
                <Typography variant="body2" noWrap>
                  {track.track}
                  <Typography component="span" variant="body2" color="text.secondary">
                    {" — "}
                    {track.artist}
                  </Typography>
                </Typography>
              </Box>
            </Box>
          </>
        ) : null}
      </Paper>
    </ListItem>
  );
}

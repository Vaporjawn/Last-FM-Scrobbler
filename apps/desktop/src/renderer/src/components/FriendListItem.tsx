import type { JSX } from "react";
import StarIcon from "@mui/icons-material/Star";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Friend, RecentTrack } from "@lastfm-scrobbler/core";
import type { FriendActivityState } from "../hooks/use-friends-activity.js";
import { ScrobblingIndicator } from "./ScrobblingIndicator.js";
import { TrackArtworkAvatar } from "./shared/TrackArtworkAvatar.js";

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

/** Friend avatar size — bumped up from MUI's 40px default so real Last.fm photos
 * actually read at list scale; matches `ScrobbleListItem`'s row avatar for a
 * consistent list-avatar size across the app. The nested activity card's own avatar
 * stays a step smaller (see `ACTIVITY_AVATAR_SIZE` below) to keep the visual hierarchy
 * — this row is about the friend, the card beneath it is a secondary detail. */
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
}

/**
 * One row of `FriendsPage`'s list: the friend's real Last.fm avatar (`friend.avatarUrl`
 * — comes directly from `user.getFriends`, no separate lookup needed; `Avatar` falls
 * back to a letter automatically when it's absent, same as `ProfilePage`'s account
 * card), a small gold star under the avatar for a Last.fm Pro subscriber
 * (`friend.isSubscriber` — also parsed directly out of the same `user.getFriends`
 * response, no separate lookup), their real name and/or self-reported location (see
 * `formatSecondaryLine` — either, both, or neither, same "no lookup needed" source),
 * plus their most recent activity, passed in via `activity` — see that prop's
 * docstring for why this component doesn't fetch it itself. The activity itself is
 * rendered as its own small nested `Paper` card (real album art — `track.imageUrl`,
 * the same real-image field `ScrobbleListItem` already renders for scrobble history,
 * falling back to a note/play icon the same way — plus the status chip/timestamp and
 * track/artist text), visually set apart from the friend's own row above it, and —
 * when `onSelectTrack` is given — clickable through to that track's
 * `ScrobbleDetailPage`, the same drill-down `ScrobbleListItem`'s own row offers.
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

export function FriendListItem({ friend, activity, onSelectTrack }: FriendListItemProps): JSX.Element {
  const { track } = activity;

  return (
    <ListItem divider sx={{ display: "block", py: 1.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <ListItemAvatar>
          <Stack spacing={0.25} sx={{ alignItems: "center" }}>
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
        </ListItemAvatar>
        <ListItemText primary={friend.username} secondary={formatSecondaryLine(friend)} sx={{ my: 0 }} />
      </Stack>

      {track ? (
        <Box sx={{ mt: 1.25, ml: `${AVATAR_SIZE + 12}px` }}>
          <Paper
            {...(onSelectTrack
              ? {
                  component: ButtonBase,
                  onClick: () => {
                    onSelectTrack(track);
                  },
                }
              : {})}
            variant="outlined"
            {...(onSelectTrack ? { "aria-label": `View details for ${track.track}` } : {})}
            sx={{
              p: 1,
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              bgcolor: "action.hover",
              width: "100%",
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
              {track.nowPlaying ? (
                <Chip
                  icon={<ScrobblingIndicator />}
                  label="Scrobbling now"
                  size="small"
                  color="primary"
                  sx={{ mb: 0.5 }}
                />
              ) : track.timestamp !== undefined ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  {formatTimestamp(track.timestamp)}
                </Typography>
              ) : null}
              <Typography variant="body2" noWrap>
                {track.track}
                <Typography component="span" variant="body2" color="text.secondary">
                  {" — "}
                  {track.artist}
                </Typography>
              </Typography>
            </Box>
          </Paper>
        </Box>
      ) : null}
    </ListItem>
  );
}

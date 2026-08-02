import type { JSX } from "react";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StarIcon from "@mui/icons-material/Star";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Friend } from "@lastfm-scrobbler/core";
import type { FriendActivityState } from "../hooks/use-friends-activity.js";
import { ScrobblingIndicator } from "./ScrobblingIndicator.js";

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
}

/**
 * One row of `FriendsPage`'s list: the friend's real Last.fm avatar (`friend.avatarUrl`
 * — comes directly from `user.getFriends`, no separate lookup needed; `Avatar` falls
 * back to a letter automatically when it's absent, same as `ProfilePage`'s account
 * card), a small gold star under the avatar for a Last.fm Pro subscriber
 * (`friend.isSubscriber` — also parsed directly out of the same `user.getFriends`
 * response, no separate lookup), plus their most recent activity, passed in via
 * `activity` — see that prop's docstring for why this component doesn't fetch it
 * itself. The activity itself is
 * rendered as its own small nested `Paper` card (real album art — `track.imageUrl`,
 * the same real-image field `ScrobbleListItem` already renders for scrobble history,
 * falling back to a note/play icon the same way — plus the status chip/timestamp and
 * track/artist text), visually set apart from the friend's own row above it.
 */
export function FriendListItem({ friend, activity }: FriendListItemProps): JSX.Element {
  const { track } = activity;

  return (
    <ListItem divider sx={{ display: "block", py: 1.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <ListItemAvatar>
          <Stack spacing={0.25} sx={{ alignItems: "center" }}>
            <Avatar
              src={friend.avatarUrl}
              alt={friend.username}
              sx={{ bgcolor: "action.selected", color: "text.secondary" }}
            >
              {friend.username.slice(0, 1).toUpperCase()}
            </Avatar>
            {friend.isSubscriber ? (
              <StarIcon
                titleAccess="Last.fm Pro subscriber"
                sx={{ fontSize: 14, color: "warning.main" }}
              />
            ) : null}
          </Stack>
        </ListItemAvatar>
        <ListItemText primary={friend.username} secondary={friend.realName} sx={{ my: 0 }} />
      </Stack>

      {track ? (
        <Box sx={{ mt: 1.25, ml: `${40 + 12}px` }}>
          <Paper
            variant="outlined"
            sx={{
              p: 1,
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              bgcolor: "action.hover",
            }}
          >
            <Avatar
              variant="rounded"
              src={track.imageUrl}
              alt={track.track}
              sx={{
                width: 40,
                height: 40,
                flexShrink: 0,
                bgcolor: track.nowPlaying ? "primary.main" : "action.selected",
                color: track.nowPlaying ? "primary.contrastText" : "text.secondary",
              }}
            >
              {track.nowPlaying ? <PlayArrowIcon fontSize="small" /> : <MusicNoteIcon fontSize="small" />}
            </Avatar>
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

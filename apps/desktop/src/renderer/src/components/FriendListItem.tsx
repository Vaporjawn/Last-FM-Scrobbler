import type { JSX } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Friend } from "@lastfm-scrobbler/core";
import { useFriendActivity } from "../hooks/use-friend-activity.js";

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export interface FriendListItemProps {
  readonly friend: Friend;
}

/**
 * One row of `FriendsPage`'s list: the friend's real Last.fm avatar (`friend.avatarUrl`
 * — comes directly from `user.getFriends`, no separate lookup needed; `Avatar` falls
 * back to a letter automatically when it's absent, same as `ProfilePage`'s account
 * card) plus their most recent activity (`useFriendActivity`, a separate per-row
 * `user.getRecentTracks` call — Last.fm has no bulk endpoint for this, so each row
 * fetches its own independently and simply shows nothing extra while loading, on
 * failure, or if the friend has no scrobble history — see that hook's docstring).
 */
export function FriendListItem({ friend }: FriendListItemProps): JSX.Element {
  const { track } = useFriendActivity(friend.username);

  return (
    <ListItem divider sx={{ display: "block", py: 1.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <ListItemAvatar>
          <Avatar
            src={friend.avatarUrl}
            alt={friend.username}
            sx={{ bgcolor: "action.selected", color: "text.secondary" }}
          >
            {friend.username.slice(0, 1).toUpperCase()}
          </Avatar>
        </ListItemAvatar>
        <ListItemText primary={friend.username} secondary={friend.realName} sx={{ my: 0 }} />
      </Stack>

      {track ? (
        <Box sx={{ mt: 1, ml: `${40 + 12}px` }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            {track.nowPlaying ? (
              <Chip label="Scrobbling now" size="small" color="primary" />
            ) : track.timestamp !== undefined ? (
              <Typography variant="caption" color="text.secondary">
                {formatTimestamp(track.timestamp)}
              </Typography>
            ) : null}
            <Typography variant="body2">
              {track.track}
              <Typography component="span" variant="body2" color="text.secondary">
                {" — "}
                {track.artist}
              </Typography>
            </Typography>
          </Stack>
        </Box>
      ) : null}
    </ListItem>
  );
}

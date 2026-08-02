import type { JSX } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { useAuth } from "../hooks/use-auth.js";
import { useFriends } from "../hooks/use-friends.js";

export function FriendsPage(): JSX.Element {
  const { activeAccount } = useAuth();
  const { friends, loading, error } = useFriends(activeAccount);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Friends
      </Typography>

      {!activeAccount ? (
        <Typography color="text.secondary">
          Log in with Last.fm on the Preferences page to see your friends' activity.
        </Typography>
      ) : loading ? (
        <CircularProgress size={24} />
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : friends.length === 0 ? (
        <Typography color="text.secondary">No friends to show.</Typography>
      ) : (
        <List>
          {friends.map((friend) => (
            <ListItem key={friend.username} divider>
              <ListItemAvatar>
                <Avatar>{friend.username.slice(0, 1).toUpperCase()}</Avatar>
              </ListItemAvatar>
              <ListItemText primary={friend.username} secondary={friend.realName} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}

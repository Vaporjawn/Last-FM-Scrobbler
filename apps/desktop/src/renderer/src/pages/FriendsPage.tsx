import type { JSX } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { FriendListItem } from "../components/FriendListItem.js";
import { LoginPrompt } from "../components/LoginPrompt.js";
import { useAuth } from "../hooks/use-auth.js";
import { useFriends } from "../hooks/use-friends.js";
import type { PageProps } from "./page-props.js";

export function FriendsPage({ onNavigateToPreferences }: PageProps): JSX.Element {
  const { activeAccount } = useAuth();
  const { friends, loading, error } = useFriends(activeAccount);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Friends
      </Typography>

      {!activeAccount ? (
        <LoginPrompt
          message="Log in with Last.fm on the Preferences page to see your friends' activity."
          onNavigateToPreferences={onNavigateToPreferences}
        />
      ) : loading ? (
        <CircularProgress size={24} />
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : friends.length === 0 ? (
        <Typography color="text.secondary">No friends to show.</Typography>
      ) : (
        <Paper variant="outlined" sx={{ maxWidth: 480 }}>
          <List disablePadding>
            {friends.map((friend) => (
              <FriendListItem key={friend.username} friend={friend} />
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}

import type { JSX } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useAuth } from "../hooks/use-auth.js";
import { useTopArtists } from "../hooks/use-top-artists.js";

export function ProfilePage(): JSX.Element {
  const { activeAccount } = useAuth();
  const { artists, loading, error } = useTopArtists(activeAccount);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Profile
      </Typography>

      {!activeAccount ? (
        <Typography color="text.secondary">
          Log in with Last.fm on the Preferences page to see your profile.
        </Typography>
      ) : (
        <>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 3 }}>
            <Avatar sx={{ width: 56, height: 56 }}>{activeAccount.slice(0, 1).toUpperCase()}</Avatar>
            <Typography variant="h6">{activeAccount}</Typography>
          </Stack>

          <Typography variant="subtitle1" gutterBottom>
            Top Artists
          </Typography>
          {loading ? (
            <CircularProgress size={24} />
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : artists.length === 0 ? (
            <Typography color="text.secondary">No scrobbles yet.</Typography>
          ) : (
            <List>
              {artists.map((artist) => (
                <ListItem key={artist.name} divider>
                  <ListItemAvatar>
                    <Avatar>{artist.name.slice(0, 1).toUpperCase()}</Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={artist.name} secondary={`${artist.playCount} plays`} />
                </ListItem>
              ))}
            </List>
          )}
        </>
      )}
    </Box>
  );
}

import type { JSX } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LoginPrompt } from "../components/LoginPrompt.js";
import { useAuth } from "../hooks/use-auth.js";
import { useTopArtists } from "../hooks/use-top-artists.js";
import { useUserProfile } from "../hooks/use-user-profile.js";
import type { PageProps } from "./page-props.js";

/** Left offset that lines a bar up under the artist name (rank column + avatar +
 * the two gaps between them) — see the Stack below. */
const BAR_INDENT_PX = 20 + 12 + 32 + 12;

export function ProfilePage({ onNavigateToPreferences }: PageProps): JSX.Element {
  const { activeAccount } = useAuth();
  const { artists, loading, error } = useTopArtists(activeAccount);
  // Real avatar photo for the account card below — see use-user-profile.ts and
  // UserProfile.avatarUrl's docstring for why this (unlike the per-artist images
  // Last.fm's API returns elsewhere) is a genuine, working image. `profile` stays
  // `undefined` while loading, on fetch failure, or if the account has no photo set;
  // MUI's `Avatar` falls back to the letter children automatically whenever `src` is
  // `undefined` (and self-heals to that fallback if a real `src` fails to load).
  const { profile } = useUserProfile(activeAccount);

  if (!activeAccount) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Profile
        </Typography>
        <LoginPrompt
          message="Log in with Last.fm on the Preferences page to see your profile."
          onNavigateToPreferences={onNavigateToPreferences}
        />
      </Box>
    );
  }

  const maxPlayCount = Math.max(1, ...artists.map((artist) => artist.playCount));

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Profile
      </Typography>

      <Card variant="outlined" sx={{ p: 2.5, mb: 3, maxWidth: 480 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Avatar
            src={profile?.avatarUrl}
            alt={activeAccount}
            sx={{ width: 56, height: 56, bgcolor: "primary.main" }}
          >
            {activeAccount.slice(0, 1).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="h6">{activeAccount}</Typography>
            <Typography variant="body2" color="text.secondary">
              Last.fm account
            </Typography>
          </Box>
        </Stack>
      </Card>

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
        <List disablePadding sx={{ maxWidth: 480 }}>
          {artists.map((artist, index) => (
            <ListItem key={artist.name} divider sx={{ display: "block", px: 0, py: 1.5 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ width: 20, flexShrink: 0, textAlign: "right" }}
                >
                  {index + 1}
                </Typography>
                <Avatar sx={{ width: 32, height: 32 }}>{artist.name.slice(0, 1).toUpperCase()}</Avatar>
                <ListItemText primary={artist.name} secondary={`${artist.playCount} plays`} sx={{ my: 0 }} />
              </Stack>
              <Box
                sx={{
                  height: 4,
                  mt: 1,
                  ml: `${BAR_INDENT_PX}px`,
                  borderRadius: 2,
                  bgcolor: "action.hover",
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    height: "100%",
                    width: `${(artist.playCount / maxPlayCount) * 100}%`,
                    bgcolor: "primary.main",
                  }}
                />
              </Box>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}

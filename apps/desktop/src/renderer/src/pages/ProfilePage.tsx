import type { JSX } from "react";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import List from "@mui/material/List";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AsyncState } from "../components/AsyncState.js";
import { LoginPrompt } from "../components/LoginPrompt.js";
import { PageHeader } from "../components/PageHeader.js";
import { TopArtistListItem } from "../components/TopArtistListItem.js";
import { useAuth } from "../hooks/use-auth.js";
import { useTopArtists } from "../hooks/use-top-artists.js";
import { useUserProfile } from "../hooks/use-user-profile.js";
import type { PageProps } from "./page-props.js";

export function ProfilePage({ onNavigateToSettings }: PageProps): JSX.Element {
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
        <PageHeader title="Profile" />
        <LoginPrompt
          message="Log in with Last.fm on the Settings page to see your profile."
          onNavigateToSettings={onNavigateToSettings}
        />
      </Box>
    );
  }

  const maxPlayCount = Math.max(1, ...artists.map((artist) => artist.playCount));

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader title="Profile" />

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
        <AsyncState kind="loading" label="Loading top artists…" />
      ) : error ? (
        <AsyncState kind="error" message={error} />
      ) : artists.length === 0 ? (
        <AsyncState kind="empty" icon={<TrendingUpIcon sx={{ fontSize: 48 }} />} message="No scrobbles yet." />
      ) : (
        <List disablePadding sx={{ maxWidth: 480 }}>
          {artists.map((artist, index) => (
            <TopArtistListItem
              key={artist.name}
              artist={artist}
              rank={index + 1}
              maxPlayCount={maxPlayCount}
            />
          ))}
        </List>
      )}
    </Box>
  );
}

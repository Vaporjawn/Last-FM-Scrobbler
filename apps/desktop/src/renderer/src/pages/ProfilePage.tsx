import type { JSX } from "react";
import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LoginPrompt } from "../components/LoginPrompt.js";
import { PageHeader } from "../components/PageHeader.js";
import { TopArtistsSection, type TopArtistsViewMode } from "../components/TopArtistsSection.js";
import { useAuth } from "../hooks/use-auth.js";
import { useTopArtists } from "../hooks/use-top-artists.js";
import { useUserProfile } from "../hooks/use-user-profile.js";
import type { PageProps } from "./page-props.js";

/** Matches the reference Last.fm client's own "This Week" row count — 10 for the
 * all-time section (this page's original limit, unchanged) reads as too long a list
 * for a 7-day window that, for most accounts, has far fewer distinct artists anyway. */
const THIS_WEEK_LIMIT = 5;
const OVERALL_LIMIT = 10;

export function ProfilePage({ onNavigateToSettings }: PageProps): JSX.Element {
  const { activeAccount } = useAuth();
  const {
    artists: weekArtists,
    loading: weekLoading,
    error: weekError,
  } = useTopArtists(activeAccount, THIS_WEEK_LIMIT, "7day");
  const {
    artists: overallArtists,
    loading: overallLoading,
    error: overallError,
  } = useTopArtists(activeAccount, OVERALL_LIMIT);
  // Real avatar photo for the account card below — see use-user-profile.ts and
  // UserProfile.avatarUrl's docstring for why this (unlike the per-artist images
  // Last.fm's API returns elsewhere) is a genuine, working image. `profile` stays
  // `undefined` while loading, on fetch failure, or if the account has no photo set;
  // MUI's `Avatar` falls back to the letter children automatically whenever `src` is
  // `undefined` (and self-heals to that fallback if a real `src` fails to load).
  const { profile } = useUserProfile(activeAccount);
  // Session-only, not persisted to AppSettings — a lighter-weight version of the
  // reference Last.fm client's own "Chart style" preference (which also configures a
  // default timeframe and artist count via a whole settings panel); this app just
  // exposes the one choice that actually changes what's on screen. Revisit if that
  // fuller settings surface turns out to matter later.
  const [viewMode, setViewMode] = useState<TopArtistsViewMode>("list");

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

  const handleViewModeChange = (event: SelectChangeEvent<TopArtistsViewMode>): void => {
    setViewMode(event.target.value);
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader title="Profile" />

      <Card variant="outlined" sx={{ p: 2.5, mb: 3, maxWidth: 480 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Avatar
            src={profile?.avatarUrl}
            alt={activeAccount}
            sx={{ width: 80, height: 80, fontSize: 32, bgcolor: "primary.main" }}
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

      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 1, maxWidth: 480 }}
      >
        <Typography variant="subtitle1">Top Artists</Typography>
        <Select
          size="small"
          value={viewMode}
          onChange={handleViewModeChange}
          inputProps={{ "aria-label": "Top Artists view" }}
        >
          <MenuItem value="list">List</MenuItem>
          <MenuItem value="tiles">Tiles</MenuItem>
        </Select>
      </Stack>

      <TopArtistsSection
        title="Top Artists This Week"
        artists={weekArtists}
        loading={weekLoading}
        error={weekError}
        viewMode={viewMode}
        emptyMessage="No scrobbles this week."
      />

      <TopArtistsSection
        title="Top Artists Overall"
        artists={overallArtists}
        loading={overallLoading}
        error={overallError}
        viewMode={viewMode}
        emptyMessage="No scrobbles yet."
      />
    </Box>
  );
}

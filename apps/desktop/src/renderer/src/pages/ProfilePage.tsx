import type { JSX } from "react";
import { useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LoginPrompt } from "../components/LoginPrompt.js";
import { PageHeader } from "../components/PageHeader.js";
import { StatBox } from "../components/shared/StatBox.js";
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

/** "Member since March 2003" — built with the platform's own `Intl.DateTimeFormat`
 * rather than a date-formatting dependency; this app has none, and one label doesn't
 * warrant introducing one. */
function formatMemberSince(registeredAtUnixSeconds: number): string {
  const date = new Date(registeredAtUnixSeconds * 1000);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

export interface ProfilePageProps extends PageProps {
  /** Whose profile to show — defaults to the logged-in account when omitted, the
   * original (and still primary) way to reach this page, via the sidebar. `App.tsx`
   * passes this explicitly when drilling in from a friend's own row on `FriendsPage`
   * (see `FriendListItem.onSelectFriend`), in which case it's the friend's username,
   * not necessarily the logged-in account. */
  readonly username?: string;
  /** Reveals a "Back to {backLabel}" button above the page content when given.
   * `App.tsx` always supplies this when showing a friend's profile as a drill-down
   * (mirroring `ScrobbleDetailPage.onBack`), and never supplies it for the sidebar's
   * own "Profile" destination, which has nowhere to "back" to. */
  readonly onBack?: () => void;
  /** Label for the back button's destination — same "Back to {backLabel}" convention
   * as `ScrobbleDetailPage.backLabel`. Has no effect when `onBack` is omitted. */
  readonly backLabel?: string;
}

export function ProfilePage({
  onNavigateToSettings,
  username,
  onBack,
  backLabel = "Friends",
}: ProfilePageProps): JSX.Element {
  const { activeAccount } = useAuth();
  // Falls back to the logged-in account when no explicit `username` is given — the
  // sidebar's own "Profile" destination never passes one, so this preserves that
  // original behavior exactly; a friend drill-down always passes one instead (see
  // `App.tsx`). Deliberately NOT gated on `activeAccount` being set: a friend's
  // profile is independently viewable by username alone (`user.getInfo`/
  // `user.getTopArtists` need no auth), so requiring a *logged-in* account here would
  // be an unnecessary restriction — even though in practice `FriendsPage` itself
  // already requires one before its list (and this drill-down) is reachable at all.
  const targetUsername = username ?? activeAccount;
  const isOwnProfile = targetUsername === activeAccount;
  const {
    artists: weekArtists,
    loading: weekLoading,
    error: weekError,
  } = useTopArtists(targetUsername, THIS_WEEK_LIMIT, "7day");
  const {
    artists: overallArtists,
    loading: overallLoading,
    error: overallError,
  } = useTopArtists(targetUsername, OVERALL_LIMIT);
  // Real avatar photo for the account card below — see use-user-profile.ts and
  // UserProfile.avatarUrl's docstring for why this (unlike the per-artist images
  // Last.fm's API returns elsewhere) is a genuine, working image. `profile` stays
  // `undefined` while loading, on fetch failure, or if the account has no photo set;
  // MUI's `Avatar` falls back to the letter children automatically whenever `src` is
  // `undefined` (and self-heals to that fallback if a real `src` fails to load).
  const { profile } = useUserProfile(targetUsername);
  // Session-only, not persisted to AppSettings — a lighter-weight version of the
  // reference Last.fm client's own "Chart style" preference (which also configures a
  // default timeframe and artist count via a whole settings panel); this app just
  // exposes the one choice that actually changes what's on screen. Revisit if that
  // fuller settings surface turns out to matter later.
  const [viewMode, setViewMode] = useState<TopArtistsViewMode>("list");

  const backButton = onBack ? (
    <Button
      size="small"
      color="inherit"
      startIcon={<ArrowBackIcon fontSize="small" />}
      onClick={onBack}
      sx={{ mb: 1 }}
    >
      Back to {backLabel}
    </Button>
  ) : null;

  if (!targetUsername) {
    return (
      <Box sx={{ p: 3 }}>
        {backButton}
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
      {backButton}
      <PageHeader title={isOwnProfile ? "Profile" : targetUsername} />

      <Card variant="outlined" sx={{ p: 2.5, mb: 3, maxWidth: 480 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Avatar
            src={profile?.avatarUrl}
            alt={targetUsername}
            sx={{ width: 80, height: 80, fontSize: 32, bgcolor: "primary.main" }}
          >
            {targetUsername.slice(0, 1).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="h6">{targetUsername}</Typography>
            <Typography variant="body2" color="text.secondary">
              Last.fm account
            </Typography>
          </Box>
        </Stack>
        {profile?.totalScrobbles !== undefined || profile?.registeredAt !== undefined ? (
          <Box sx={{ mt: 2 }}>
            {profile.totalScrobbles !== undefined ? (
              <StatBox value={profile.totalScrobbles.toLocaleString()} label="Scrobbles" />
            ) : null}
            {profile.registeredAt !== undefined ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: profile.totalScrobbles !== undefined ? 1 : 0 }}
              >
                Member since {formatMemberSince(profile.registeredAt)}
              </Typography>
            ) : null}
          </Box>
        ) : null}
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

import type { JSX } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { RecentTrack } from "@lastfm-scrobbler/core";
import { ArtistInfoPanel } from "../components/ArtistInfoPanel.js";
import { RefreshButton } from "../components/shared/RefreshButton.js";
import { TrackLoveTagControls } from "../components/shared/TrackLoveTagControls.js";
import { useArtistInfo } from "../hooks/use-artist-info.js";
import { useArtistTopTags } from "../hooks/use-artist-top-tags.js";
import { useTrackInfo } from "../hooks/use-track-info.js";

const ART_SIZE = 200;

export interface ScrobbleDetailPageProps {
  /** The row that was clicked on ScrobblesPage — used to render the hero section
   * immediately (title/artist/album/art/loved, all already known from that list) while
   * `useTrackInfo`/`useArtistInfo` fill in the richer, network-fetched detail
   * underneath. */
  readonly track: RecentTrack;
  /** The active account — always present in practice (this page is only reachable by
   * clicking a row on the already-login-gated ScrobblesPage), but typed as optional
   * defensively rather than asserted, matching how the rest of this app treats
   * `activeAccount`. Personal stats (userPlayCount, "Play(s) in your library") are
   * simply omitted without one. */
  readonly activeAccount: string | undefined;
  readonly onBack: () => void;
  /** Which view's list this scrobble was actually clicked from ("Scrobbles",
   * "Friends") — drives the back button's label ("Back to {backLabel}"). Defaults to
   * "Scrobbles" (this page's original, only source) so existing callers that don't
   * pass it keep exactly their previous label. `App.tsx` computes the real value from
   * whichever view is currently active via `getViewLabel` — `onBack` itself always
   * just reveals that same view again, so the label and the actual destination never
   * drift apart. */
  readonly backLabel?: string;
}

/**
 * A single past scrobble's full detail: real album art, listener/play stats, this
 * account's own play counts, popular tags, and the same artist-info panel
 * NowPlayingPage shows (bio, similar artists) — reached by clicking a row on
 * ScrobblesPage's list or a friend's activity card on FriendsPage (see
 * `ScrobbleListItem`'s and `FriendListItem`'s own `onSelect`/`onSelectTrack`). Love/tag
 * actions work exactly as they do everywhere else in this app (see `useTrackActions`).
 */
export function ScrobbleDetailPage({
  track,
  activeAccount,
  onBack,
  backLabel = "Scrobbles",
}: ScrobbleDetailPageProps): JSX.Element {
  const {
    track: trackDetail,
    refreshing: trackInfoRefreshing,
    refetch: refetchTrackInfo,
  } = useTrackInfo(track.artist, track.track, activeAccount);
  const {
    info: artistInfo,
    similarArtists,
    loading: artistInfoLoading,
    refreshing: artistInfoRefreshing,
    error: artistInfoError,
    refetch: refetchArtistInfo,
  } = useArtistInfo(track.artist, activeAccount);
  const {
    tags: topTags,
    refreshing: topTagsRefreshing,
    refetch: refetchTopTags,
  } = useArtistTopTags(track.artist);
  // One combined refresh for the whole page: track stats, artist bio/similar
  // artists, and popular tags are three independent fetches (see each hook's own
  // docstring for why), but from the user's point of view this page shows one
  // track's worth of Last.fm data, refreshed together.
  const refreshing = trackInfoRefreshing || artistInfoRefreshing || topTagsRefreshing;
  const refetchAll = (): void => {
    refetchTrackInfo();
    refetchArtistInfo();
    refetchTopTags();
  };

  // Last.fm's own URL scheme (artist/_/track) — built synchronously so the "view on
  // Last.fm" link works immediately, not just once track.getInfo resolves; swapped for
  // the real `trackDetail.url` once that's in, in case Last.fm's actual URL ever
  // differs from this app's own guess (e.g. canonicalized artist/track spelling).
  const guessedTrackUrl = `https://www.last.fm/music/${encodeURIComponent(track.artist)}/_/${encodeURIComponent(track.track)}`;
  const trackUrl = trackDetail?.url ?? guessedTrackUrl;
  const imageUrl = track.imageUrl ?? trackDetail?.imageUrl;
  const album = track.album ?? trackDetail?.album;

  const listenedToArtistTimes = artistInfo?.userPlayCount;
  const listenedToTrackTimes = trackDetail?.userPlayCount;

  return (
    <Box sx={{ height: "100%", overflow: "auto" }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Button
          size="small"
          color="inherit"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={onBack}
        >
          Back to {backLabel}
        </Button>
        <RefreshButton onRefresh={refetchAll} refreshing={refreshing} label="Refresh track info" />
      </Stack>

      <Box sx={{ p: 4 }}>
        {/* `md` rather than MUI's usual `sm` here on purpose: this breakpoint reacts to
            the whole window's width, not this Box's actual available width, and the
            sidebar (200px expanded) eats into that — at exactly this app's own 680px
            minimum window width, `sm` (600px) would already force the 200px avatar
            onto one row alongside the text column with only ~184px left for it. `md`
            (900px) keeps that combination stacked until there's genuinely enough room
            for a row layout to still look like the reference design instead of
            cramped. */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={4} sx={{ alignItems: { md: "flex-start" } }}>
          <Avatar
            variant="rounded"
            src={imageUrl}
            alt={track.track}
            sx={{
              width: ART_SIZE,
              height: ART_SIZE,
              flexShrink: 0,
              bgcolor: "action.selected",
              color: "text.secondary",
              boxShadow: 4,
            }}
          >
            <MusicNoteIcon sx={{ fontSize: 64 }} />
          </Avatar>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h4" sx={{ wordBreak: "break-word" }} gutterBottom>
              {track.track}
            </Typography>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              by {track.artist}
            </Typography>

            <Stack direction="row" spacing={0.5} sx={{ my: 1 }}>
              <TrackLoveTagControls artist={track.artist} track={track.track} initialLoved={track.loved} />
              <Tooltip title="View on Last.fm">
                <IconButton
                  size="small"
                  component={Link}
                  href={trackUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="View on Last.fm"
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>

            {album ? (
              <Typography variant="body1" color="text.secondary">
                from {album}
              </Typography>
            ) : null}

            {listenedToArtistTimes !== undefined || listenedToTrackTimes !== undefined ? (
              <Paper
                variant="outlined"
                sx={{
                  mt: 2.5,
                  p: 1.5,
                  display: "inline-block",
                  bgcolor: "background.default",
                }}
              >
                <Typography variant="body2">
                  You've listened to{" "}
                  {listenedToArtistTimes !== undefined ? (
                    <>
                      <strong>{track.artist}</strong> {listenedToArtistTimes.toLocaleString()} time
                      {listenedToArtistTimes === 1 ? "" : "s"}
                    </>
                  ) : null}
                  {listenedToArtistTimes !== undefined && listenedToTrackTimes !== undefined ? " and " : null}
                  {listenedToTrackTimes !== undefined ? (
                    <>
                      <strong>{track.track}</strong> {listenedToTrackTimes.toLocaleString()} time
                      {listenedToTrackTimes === 1 ? "" : "s"}
                    </>
                  ) : null}
                  .
                </Typography>
              </Paper>
            ) : null}
          </Box>
        </Stack>

        <Divider sx={{ my: 4 }} />

        <ArtistInfoPanel
          artistName={track.artist}
          info={artistInfo}
          similarArtists={similarArtists}
          loading={artistInfoLoading}
          error={artistInfoError}
          topTags={topTags}
        />
      </Box>
    </Box>
  );
}

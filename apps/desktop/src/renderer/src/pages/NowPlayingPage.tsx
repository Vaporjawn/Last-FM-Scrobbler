import type { JSX } from "react";
import AlbumIcon from "@mui/icons-material/Album";
import PauseIcon from "@mui/icons-material/Pause";
import StopIcon from "@mui/icons-material/Stop";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PlaybackState } from "@lastfm-scrobbler/shared-types";
import { ArtistInfoPanel } from "../components/ArtistInfoPanel.js";
import { AsyncState } from "../components/AsyncState.js";
import { PageHeader } from "../components/PageHeader.js";
import { ScrobblingIndicator } from "../components/ScrobblingIndicator.js";
import { RefreshButton } from "../components/shared/RefreshButton.js";
import { StatBox } from "../components/shared/StatBox.js";
import { TrackLoveTagControls } from "../components/shared/TrackLoveTagControls.js";
import { useArtistInfo } from "../hooks/use-artist-info.js";
import { useAuth } from "../hooks/use-auth.js";
import { useNowPlaying } from "../hooks/use-now-playing.js";
import { useTrackDetail } from "../hooks/use-track-detail.js";
import { resolveSourceAppName } from "../utils/resolve-source-app-name.js";

const STATE_LABEL = { playing: "Playing", paused: "Paused", stopped: "Stopped" } as const;

/** Formats a duration in whole seconds as `m:ss` (e.g. 340 -> "5:40"). Track durations
 * only ever need minutes:seconds here — nothing in this app plays anything long enough
 * to need an hours component. */
function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function StateIcon({ state }: { state: PlaybackState }): JSX.Element {
  switch (state) {
    case "playing":
      // The same animated equalizer ScrobbleListItem/FriendListItem already use for
      // their own "Now Playing"/"Scrobbling now" chips — this page is the one place
      // literally called "Now Playing" that hadn't adopted it yet.
      return <ScrobblingIndicator />;
    case "paused":
      return <PauseIcon fontSize="small" />;
    case "stopped":
    default:
      return <StopIcon fontSize="small" />;
  }
}

/** The currently-playing track's real album art (via `useTrackImage` — Last.fm's
 * `track.getInfo`) when one is on file, falling back to a gradient/record-icon
 * placeholder otherwise — the same `src`-falls-back-to-children `Avatar` pattern
 * `ScrobbleListItem` already uses for scrobble history's art. */
function NowPlayingArtwork({ imageUrl, title }: { imageUrl: string | undefined; title: string }): JSX.Element {
  return (
    <Avatar
      variant="rounded"
      src={imageUrl}
      alt={title}
      sx={{
        width: 200,
        height: 200,
        flexShrink: 0,
        borderRadius: 2,
        boxShadow: 4,
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
      }}
    >
      <AlbumIcon sx={{ fontSize: 88, color: "rgba(255,255,255,0.85)" }} />
    </Avatar>
  );
}

export function NowPlayingPage(): JSX.Element {
  const { track, state, positionSec } = useNowPlaying();
  const { activeAccount } = useAuth();
  const {
    info,
    similarArtists,
    loading: artistInfoLoading,
    refreshing: artistInfoRefreshing,
    error: artistInfoError,
    refetch: refetchArtistInfo,
  } = useArtistInfo(track?.artist);
  const {
    detail: trackDetail,
    refreshing: trackDetailRefreshing,
    refetch: refetchTrackDetail,
  } = useTrackDetail(track?.artist, track?.title, activeAccount);
  // One combined refresh for the whole page's Last.fm data — the "now playing" track
  // itself is pushed live over IPC (see useNowPlaying), so there's nothing to refetch
  // there; this refreshes the two things that genuinely are point-in-time fetches
  // (track stats/link, artist bio/similar artists).
  const refreshing = trackDetailRefreshing || artistInfoRefreshing;
  const refetchAll = (): void => {
    refetchTrackDetail();
    refetchArtistInfo();
  };

  if (!track) {
    return (
      <Box
        sx={{
          p: 3,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <Typography variant="h6" gutterBottom>
          Now Playing
        </Typography>
        {/* The shared empty-state treatment every other "nothing here" state in this
            app already uses (see AsyncState's own docstring) — this was the one
            hand-built exception, predating AsyncState's introduction. Kept as its own
            centered Typography above rather than switching to PageHeader (which the
            non-empty return below uses): PageHeader's title is left-aligned, and
            AsyncState's icon/message are inherently centered — mixing the two would
            read as a mismatched layout rather than one coherent centered empty state. */}
        <AsyncState
          kind="empty"
          icon={<AlbumIcon sx={{ fontSize: 64 }} />}
          message="Nothing is playing right now."
        />
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", overflow: "auto" }}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: "center",
          px: 3,
          py: 1.5,
        }}
      >
        <Avatar sx={{ width: 32, height: 32, bgcolor: "action.selected", color: "text.secondary" }}>
          <VolumeUpIcon fontSize="small" />
        </Avatar>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>
            Scrobbling from
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {resolveSourceAppName(track.sourceApp)}
          </Typography>
        </Box>
      </Stack>
      <Divider />

      <Box sx={{ p: 4 }}>
        <PageHeader
          title="Now Playing"
          action={<RefreshButton onRefresh={refetchAll} refreshing={refreshing} label="Refresh track info" />}
        />
        {/* `md` rather than MUI's usual `sm` here on purpose — same fix as
            ScrobbleDetailPage's own hero `Stack` (see that file's comment for the
            fuller rationale): this breakpoint reacts to the *window's* width, not
            this `Box`'s actual available width, and the sidebar (200px expanded)
            eats into that. It matters most right here, since this app's own
            default window is a *portrait* 9:14 window pinned at exactly 680px wide
            (see `compute-portrait-window-size.ts`) — `sm` (600px) already fired a
            row layout there, leaving only ~480px of real content width for a
            200px avatar plus a full text column squeezed into what was left. `md`
            (900px) keeps this stacked in one generous column until the window is
            genuinely wide enough for a row to look intentional rather than
            cramped. */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={4} sx={{ alignItems: { md: "flex-start" } }}>
          <NowPlayingArtwork imageUrl={trackDetail?.imageUrl} title={track.title} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
              <Chip
                icon={<StateIcon state={state} />}
                label={STATE_LABEL[state]}
                size="small"
                color={state === "playing" ? "primary" : "default"}
              />
            </Stack>
            {track.durationSec !== undefined ? (
              <Box sx={{ mb: 1.5 }}>
                <LinearProgress
                  variant="determinate"
                  // Clamped defensively — every current PlaybackSource adapter
                  // already clamps its own reported position to the track's
                  // duration (see e.g. adapter-macos's getPosition), but a progress
                  // bar over 100% would look broken if one ever didn't.
                  value={Math.min(100, Math.max(0, (positionSec / track.durationSec) * 100))}
                  sx={{ borderRadius: 1, height: 6, mb: 0.5 }}
                />
                <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatDuration(Math.min(positionSec, track.durationSec))}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDuration(track.durationSec)}
                  </Typography>
                </Stack>
              </Box>
            ) : null}
            <Typography variant="h4" sx={{ wordBreak: "break-word" }} gutterBottom>
              {track.title}
            </Typography>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              by {track.artist}
            </Typography>
            {track.album ? (
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5 }}>
                from {track.album}
              </Typography>
            ) : null}

            {trackDetail ? (
              <Box sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={3}>
                  <StatBox
                    value={trackDetail.listeners.toLocaleString()}
                    label="Track listener(s)"
                    variant="subtitle1"
                  />
                  <StatBox
                    value={trackDetail.playCount.toLocaleString()}
                    label="Track play(s)"
                    variant="subtitle1"
                  />
                </Stack>
                <Link
                  href={trackDetail.url}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ display: "inline-block", mt: 1, fontWeight: 600 }}
                >
                  View on Last.fm
                </Link>
                {trackDetail.userPlayCount !== undefined ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                    You've listened to this track {trackDetail.userPlayCount.toLocaleString()} time
                    {trackDetail.userPlayCount === 1 ? "" : "s"}.
                  </Typography>
                ) : null}
              </Box>
            ) : null}

            <Stack direction="row" spacing={0.5}>
              <TrackLoveTagControls artist={track.artist} track={track.title} />
            </Stack>
            {!activeAccount ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                Log in with Last.fm in Settings to love or tag tracks.
              </Typography>
            ) : null}
          </Box>
        </Stack>

        <Divider sx={{ my: 4 }} />

        <ArtistInfoPanel
          artistName={track.artist}
          info={info}
          similarArtists={similarArtists}
          loading={artistInfoLoading}
          error={artistInfoError}
        />
      </Box>
    </Box>
  );
}

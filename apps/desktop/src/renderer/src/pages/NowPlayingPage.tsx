import type { JSX } from "react";
import AlbumIcon from "@mui/icons-material/Album";
import PauseIcon from "@mui/icons-material/Pause";
import StopIcon from "@mui/icons-material/Stop";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PlaybackState } from "@lastfm-scrobbler/shared-types";
import { ArtistInfoPanel } from "../components/ArtistInfoPanel.js";
import { PageHeader } from "../components/PageHeader.js";
import { ScrobblingIndicator } from "../components/ScrobblingIndicator.js";
import { TrackLoveTagControls } from "../components/TrackLoveTagControls.js";
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
  const { track, state } = useNowPlaying();
  const { activeAccount } = useAuth();
  const {
    info,
    similarArtists,
    loading: artistInfoLoading,
    error: artistInfoError,
  } = useArtistInfo(track?.artist);
  const trackDetail = useTrackDetail(track?.artist, track?.title);

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
        <AlbumIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Now Playing
        </Typography>
        <Typography color="text.secondary">Nothing is playing right now.</Typography>
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
          borderBottom: 1,
          borderColor: "divider",
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

      <Box sx={{ p: 4 }}>
        <PageHeader title="Now Playing" />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={4} sx={{ alignItems: { sm: "flex-start" } }}>
          <NowPlayingArtwork imageUrl={trackDetail?.imageUrl} title={track.title} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
              <Chip
                icon={<StateIcon state={state} />}
                label={STATE_LABEL[state]}
                size="small"
                color={state === "playing" ? "primary" : "default"}
              />
              {track.durationSec !== undefined ? (
                <Typography variant="caption" color="text.secondary">
                  {formatDuration(track.durationSec)}
                </Typography>
              ) : null}
            </Stack>
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
                  <Box>
                    <Typography variant="subtitle1">
                      {trackDetail.listeners.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Track listener(s)
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle1">
                      {trackDetail.playCount.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Track play(s)
                    </Typography>
                  </Box>
                </Stack>
                <Link
                  href={trackDetail.url}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ display: "inline-block", mt: 1, fontWeight: 600 }}
                >
                  View on Last.fm
                </Link>
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

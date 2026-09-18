import type { JSX } from "react";
import AlbumIcon from "@mui/icons-material/Album";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PauseIcon from "@mui/icons-material/Pause";
import StopIcon from "@mui/icons-material/Stop";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { PlaybackState } from "@lastfm-scrobbler/shared-types";
import { ArtistInfoPanel } from "../components/ArtistInfoPanel.js";
import { AsyncState } from "../components/AsyncState.js";
import { PageHeader } from "../components/PageHeader.js";
import { ScrobblingIndicator } from "../components/ScrobblingIndicator.js";
import { ListenedToCallout } from "../components/shared/ListenedToCallout.js";
import { RefreshButton } from "../components/shared/RefreshButton.js";
import { StatBox } from "../components/shared/StatBox.js";
import { TrackLoveTagControls } from "../components/shared/TrackLoveTagControls.js";
import { useArtistInfo } from "../hooks/use-artist-info.js";
import { useArtistTopTags } from "../hooks/use-artist-top-tags.js";
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
function NowPlayingArtwork({
  imageUrl,
  title,
}: {
  imageUrl: string | undefined;
  title: string;
}): JSX.Element {
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

/**
 * The sidebar's default landing view: whatever `useNowPlaying` currently reports (live,
 * pushed over IPC from the OS-level playback source — see that hook) plus point-in-time
 * Last.fm data fetched for it — track stats/link (`useTrackDetail`) and artist bio/
 * similar artists (`useArtistInfo`, via `ArtistInfoPanel`) — and, when logged in, love/
 * tag controls for the track. Shows an empty state when nothing is currently playing.
 */
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
  } = useArtistInfo(track?.artist, activeAccount);
  const {
    detail: trackDetail,
    refreshing: trackDetailRefreshing,
    refetch: refetchTrackDetail,
  } = useTrackDetail(track?.artist, track?.title, activeAccount);
  const {
    tags: topTags,
    refreshing: topTagsRefreshing,
    refetch: refetchTopTags,
  } = useArtistTopTags(track?.artist);
  // One combined refresh for the whole page's Last.fm data — the "now playing" track
  // itself is pushed live over IPC (see useNowPlaying), so there's nothing to refetch
  // there; this refreshes the three things that genuinely are point-in-time fetches
  // (track stats/link, artist bio/similar artists, popular tags).
  const refreshing = trackDetailRefreshing || artistInfoRefreshing || topTagsRefreshing;
  const refetchAll = (): void => {
    refetchTrackDetail();
    refetchArtistInfo();
    refetchTopTags();
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

  // Last.fm's own URL scheme (artist/_/track) — built synchronously so the "view on
  // Last.fm" icon works immediately, not just once track.getInfo resolves; swapped for
  // the real `trackDetail.url` once that's in, in case Last.fm's actual URL ever
  // differs from this app's own guess (e.g. canonicalized artist/track spelling). Same
  // approach as ScrobbleDetailPage's own `guessedTrackUrl`/`trackUrl`.
  const guessedTrackUrl = `https://www.last.fm/music/${encodeURIComponent(track.artist)}/_/${encodeURIComponent(track.title)}`;
  const trackUrl = trackDetail?.url ?? guessedTrackUrl;
  const listenedToArtistTimes = info?.userPlayCount;
  const listenedToTrackTimes = trackDetail?.userPlayCount;

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
        <Avatar
          sx={{ width: 32, height: 32, flexShrink: 0, bgcolor: "action.selected", color: "text.secondary" }}
        >
          <VolumeUpIcon fontSize="small" />
        </Avatar>
        {/* `minWidth: 0` (this is a flex row) + `wordBreak` so an unusually long
            source-app identifier — most known apps resolve to a short friendly name
            via `resolveSourceAppName`, but its fallback is the *raw*, unbounded
            platform identifier (a bundle ID, AUMID, or MPRIS bus name) for anything
            unrecognized — wraps instead of overflowing past the header's edge. */}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", lineHeight: 1.2 }}
          >
            Scrobbling from
          </Typography>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, lineHeight: 1.2, wordBreak: "break-word" }}
          >
            {resolveSourceAppName(track.sourceApp)}
          </Typography>
        </Box>
      </Stack>
      <Divider />

      <Box sx={{ p: 4 }}>
        <PageHeader
          title="Now Playing"
          action={
            <RefreshButton
              onRefresh={refetchAll}
              refreshing={refreshing}
              label="Refresh track info"
            />
          }
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
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={4}
          sx={{ alignItems: { md: "flex-start" } }}
        >
          <NowPlayingArtwork imageUrl={trackDetail?.imageUrl} title={track.title} />
          {/* `maxWidth` caps this column's width regardless of how wide the window
              gets — without it, a full-width `LinearProgress` stretches into an
              absurdly thin, hundreds-of-pixels-long line on any reasonably wide
              desktop monitor, and the bio/stat text below reads as a sparse, awkward
              single column even in the *stacked* (`xs`) layout just under the `md`
              breakpoint, where this Box alone (not sharing the row with the artwork)
              already has the whole window's width to itself. Matches ArtistInfoPanel's
              identical cap right below this, so the two sections' content stays the
              same width instead of drifting apart on wide screens. */}
          <Box sx={{ minWidth: 0, flex: 1, maxWidth: 640 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
              <Chip
                icon={<StateIcon state={state} />}
                label={STATE_LABEL[state]}
                size="small"
                color={state === "playing" ? "primary" : "default"}
              />
            </Stack>
            {/* `> 0`, not just `!== undefined` — a reported durationSec of exactly 0
                (a track with genuinely unknown duration reported as 0 rather than
                omitted, which nothing in the PlaybackSource contract rules out) would
                otherwise divide by zero below, producing NaN for the progress bar's
                value instead of a defined 0-100 number. */}
            {track.durationSec !== undefined && track.durationSec > 0 ? (
              <Box sx={{ mb: 1.5 }}>
                <LinearProgress
                  variant="determinate"
                  // Named so it's distinguishable from the other `role="progressbar"`
                  // elements this page can render at the same time (ArtistInfoPanel's
                  // "Loading artist info…" spinner) — for screen readers, and so tests
                  // can target the playback bar specifically rather than whichever
                  // progressbar happens to be mounted first.
                  aria-label="Playback progress"
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
            {/* `component="h5"` keeps this immediately after the `h4` track title in
                the document's heading order (axe: heading-order flags the jump
                straight from h4 to h6) — `variant="h6"` is kept as-is so the visual
                size/weight is unchanged; MUI decouples the two for exactly this
                case. */}
            <Typography
              variant="h6"
              component="h5"
              color="text.secondary"
              gutterBottom
              sx={{ wordBreak: "break-word" }}
            >
              by {track.artist}
            </Typography>

            <Stack direction="row" spacing={0.5} sx={{ my: 1 }}>
              <TrackLoveTagControls artist={track.artist} track={track.title} />
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
            {!activeAccount ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1.5 }}
              >
                Log in with Last.fm in Settings to love or tag tracks.
              </Typography>
            ) : null}

            {track.album ? (
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 1.5, wordBreak: "break-word" }}
              >
                from {track.album}
              </Typography>
            ) : null}

            {trackDetail ? (
              <Stack direction="row" spacing={3} sx={{ mb: 1.5 }}>
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
            ) : null}

            <ListenedToCallout
              artistName={track.artist}
              trackName={track.title}
              artistPlayCount={listenedToArtistTimes}
              trackPlayCount={listenedToTrackTimes}
            />
          </Box>
        </Stack>

        <Divider sx={{ my: 4 }} />

        <ArtistInfoPanel
          artistName={track.artist}
          info={info}
          similarArtists={similarArtists}
          loading={artistInfoLoading}
          error={artistInfoError}
          onRetry={refetchArtistInfo}
          topTags={topTags}
        />
      </Box>
    </Box>
  );
}

import type { JSX } from "react";
import { useState } from "react";
import AlbumIcon from "@mui/icons-material/Album";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { PlaybackState } from "@lastfm-scrobbler/shared-types";
import { useSnackbar } from "../contexts/snackbar-context.js";
import { useArtistInfo } from "../hooks/use-artist-info.js";
import { useNowPlaying } from "../hooks/use-now-playing.js";
import { useTrackActions } from "../hooks/use-track-actions.js";
import { resolveSourceAppName } from "../utils/resolve-source-app-name.js";
import { stripHtml } from "../utils/strip-html.js";

const STATE_LABEL = { playing: "Playing", paused: "Paused", stopped: "Stopped" } as const;
const SIMILAR_ARTIST_AVATAR_SIZE = 64;

function StateIcon({ state }: { state: PlaybackState }): JSX.Element {
  switch (state) {
    case "playing":
      return <PlayArrowIcon fontSize="small" />;
    case "paused":
      return <PauseIcon fontSize="small" />;
    case "stopped":
    default:
      return <StopIcon fontSize="small" />;
  }
}

/** Stands in for real album art — no adapter currently surfaces artwork (see
 * docs/modules/desktop.md's "Not yet built" list) — styled as a record so it still
 * reads as "this is the now-playing art slot" rather than a blank box. */
function ArtworkPlaceholder(): JSX.Element {
  return (
    <Box
      sx={{
        width: 200,
        height: 200,
        flexShrink: 0,
        borderRadius: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
        boxShadow: 4,
      }}
    >
      <AlbumIcon sx={{ fontSize: 88, color: "rgba(255,255,255,0.85)" }} />
    </Box>
  );
}

/** Stands in for a real artist/similar-artist photo — Last.fm's API no longer reliably
 * returns usable artist images (most requests get a generic placeholder back due to a
 * rights change years ago), so this app doesn't try to fetch or fake one. */
function ArtistAvatar({ name, size = 96 }: { name: string; size?: number }): JSX.Element {
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        fontSize: size / 2.4,
        bgcolor: "action.selected",
        color: "text.secondary",
        flexShrink: 0,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </Avatar>
  );
}

export function NowPlayingPage(): JSX.Element {
  const { track, state } = useNowPlaying();
  const { info, similarArtists, loading: artistInfoLoading } = useArtistInfo(track?.artist);
  const { loved, submitting, toggleLove, addTags } = useTrackActions(track?.artist, track?.title);
  const [tagAnchor, setTagAnchor] = useState<HTMLElement | null>(null);
  const [tagInput, setTagInput] = useState("");
  const { notify } = useSnackbar();

  const closeTagPopover = (): void => {
    setTagAnchor(null);
    setTagInput("");
  };

  const handleToggleLove = (): void => {
    // `toggleLove()` flips whatever `loved` currently is — capture it now so the
    // success message can say which way it went, rather than racing the hook's own
    // (necessarily one-render-later) updated value.
    const wasLoved = loved;
    void toggleLove().then((result) => {
      notify(
        result.success
          ? { message: wasLoved ? "Unloved." : "Loved.", severity: "success" }
          : { message: result.error, severity: "error" },
      );
    });
  };

  const handleAddTags = (tags: readonly string[]): void => {
    void addTags(tags).then((result) => {
      closeTagPopover();
      notify(
        result.success
          ? { message: "Tags added.", severity: "success" }
          : { message: result.error, severity: "error" },
      );
    });
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
        <AlbumIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Now Playing
        </Typography>
        <Typography color="text.secondary">Nothing is playing right now.</Typography>
      </Box>
    );
  }

  const artistLastfmUrl = `https://www.last.fm/music/${encodeURIComponent(track.artist)}`;
  const bioSummary = info?.bioSummary ? stripHtml(info.bioSummary) : undefined;

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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={4} sx={{ alignItems: { sm: "flex-start" } }}>
          <ArtworkPlaceholder />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Chip
              icon={<StateIcon state={state} />}
              label={STATE_LABEL[state]}
              size="small"
              color={state === "playing" ? "primary" : "default"}
              sx={{ mb: 1.5 }}
            />
            <Typography variant="h4" sx={{ fontWeight: 600, wordBreak: "break-word" }} gutterBottom>
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

            <Stack direction="row" spacing={0.5}>
              <Tooltip title={loved ? "Unlove this track" : "Love this track"}>
                <span>
                  <IconButton
                    size="small"
                    color={loved ? "error" : "default"}
                    disabled={submitting}
                    onClick={handleToggleLove}
                    aria-label={loved ? "Unlove this track" : "Love this track"}
                  >
                    {loved ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Add tags">
                <IconButton
                  size="small"
                  onClick={(event) => {
                    setTagAnchor(event.currentTarget);
                  }}
                  aria-label="Add tags"
                >
                  <LocalOfferOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        </Stack>

        <Popover
          open={Boolean(tagAnchor)}
          anchorEl={tagAnchor}
          onClose={closeTagPopover}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <Stack direction="row" spacing={1} sx={{ p: 1.5, alignItems: "center" }}>
            <TextField
              size="small"
              placeholder="tags, separated, by commas"
              value={tagInput}
              onChange={(event) => {
                setTagInput(event.target.value);
              }}
              autoFocus
            />
            <Button
              size="small"
              variant="contained"
              disabled={!tagInput.trim() || submitting}
              onClick={() => {
                const tags = tagInput
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean);
                handleAddTags(tags);
              }}
            >
              Add
            </Button>
          </Stack>
        </Popover>

        <Divider sx={{ my: 4 }} />

        <Stack direction="row" spacing={3} sx={{ alignItems: "flex-start" }}>
          <ArtistAvatar name={track.artist} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" gutterBottom>
              {track.artist}
            </Typography>

            {artistInfoLoading ? (
              <CircularProgress size={20} />
            ) : info ? (
              <>
                {bioSummary ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {bioSummary}
                  </Typography>
                ) : null}
                <Link href={artistLastfmUrl} target="_blank" rel="noreferrer" sx={{ fontWeight: 600 }}>
                  Read more on Last.fm
                </Link>

                <Stack direction="row" spacing={4} sx={{ mt: 2.5 }}>
                  <Box>
                    <Typography variant="h6">{info.listeners.toLocaleString()}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Listener(s)
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="h6">{info.playCount.toLocaleString()}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Play(s)
                    </Typography>
                  </Box>
                </Stack>

                {similarArtists.length > 0 ? (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Similar Artists
                    </Typography>
                    <Stack direction="row" spacing={2.5} sx={{ flexWrap: "wrap" }}>
                      {similarArtists.map((similarArtist) => (
                        <Stack
                          key={similarArtist.name}
                          spacing={0.5}
                          sx={{ alignItems: "center", width: SIMILAR_ARTIST_AVATAR_SIZE + 24 }}
                        >
                          <ArtistAvatar name={similarArtist.name} size={SIMILAR_ARTIST_AVATAR_SIZE} />
                          <Typography variant="caption" align="center" sx={{ wordBreak: "break-word" }}>
                            {similarArtist.name}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                ) : null}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No additional artist info available.
              </Typography>
            )}
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

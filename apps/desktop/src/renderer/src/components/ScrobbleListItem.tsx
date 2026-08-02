import type { JSX } from "react";
import { useState } from "react";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { RecentTrack } from "@lastfm-scrobbler/core";
import { useSnackbar } from "../contexts/snackbar-context.js";
import { useTrackActions } from "../hooks/use-track-actions.js";

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export interface ScrobbleListItemProps {
  readonly track: RecentTrack;
}

/**
 * One row of `ScrobblesPage`'s history list. Shows Last.fm's own album art when it has
 * any on file (`track.imageUrl` — `Avatar`'s `src` falls back to the plain note/play
 * icon automatically when it's absent or fails to load), and wires up love/tag actions
 * the same way `NowPlayingPage` does for the currently-playing track (see
 * `useTrackActions`) — just scoped to this row's own track. Unlike the now-playing
 * case, this row seeds the heart's initial state from `track.loved`, Last.fm's real
 * per-track status (see `RecentTrack.loved`'s docstring), not a guess.
 */
export function ScrobbleListItem({ track }: ScrobbleListItemProps): JSX.Element {
  const { loved, submitting, toggleLove, addTags } = useTrackActions(
    track.artist,
    track.track,
    track.loved,
  );
  const [tagAnchor, setTagAnchor] = useState<HTMLElement | null>(null);
  const [tagInput, setTagInput] = useState("");
  const { notify } = useSnackbar();

  const closeTagPopover = (): void => {
    setTagAnchor(null);
    setTagInput("");
  };

  const handleToggleLove = (): void => {
    // Capture the pre-toggle value now — `loved` won't reflect the flip until a render
    // after this promise resolves, so reading it inside `.then()` would race.
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

  return (
    <ListItem divider>
      <ListItemAvatar>
        <Avatar
          variant="rounded"
          src={track.imageUrl}
          alt={track.track}
          sx={{
            bgcolor: track.nowPlaying ? "primary.main" : "action.selected",
            color: track.nowPlaying ? "primary.contrastText" : "text.secondary",
          }}
        >
          {track.nowPlaying ? <PlayArrowIcon fontSize="small" /> : <MusicNoteIcon fontSize="small" />}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={track.track}
        secondary={`${track.artist}${track.album ? ` — ${track.album}` : ""}`}
      />

      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", ml: 1, flexShrink: 0 }}>
        <Tooltip title={loved ? "Unlove this track" : "Love this track"}>
          <span>
            <IconButton
              size="small"
              color={loved ? "error" : "default"}
              disabled={submitting}
              onClick={handleToggleLove}
              aria-label={loved ? `Unlove ${track.track}` : `Love ${track.track}`}
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
            aria-label={`Add tags to ${track.track}`}
          >
            <LocalOfferOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {track.nowPlaying ? (
          <Chip label="Now Playing" size="small" color="primary" sx={{ ml: 1 }} />
        ) : track.timestamp !== undefined ? (
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap", ml: 1 }}>
            {formatTimestamp(track.timestamp)}
          </Typography>
        ) : null}
      </Stack>

      <Popover
        open={Boolean(tagAnchor)}
        anchorEl={tagAnchor}
        onClose={closeTagPopover}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
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
    </ListItem>
  );
}

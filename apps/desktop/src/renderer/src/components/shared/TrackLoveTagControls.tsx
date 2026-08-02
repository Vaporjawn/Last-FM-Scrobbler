import type { JSX } from "react";
import { useState } from "react";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { useSnackbar } from "../../contexts/snackbar-context.js";
import { useTrackActions } from "../../hooks/use-track-actions.js";

export interface TrackLoveTagControlsProps {
  readonly artist: string;
  readonly track: string;
  /** Seeds the heart's initial state from a known value (e.g. `RecentTrack.loved`) —
   * omit when there's nothing to seed from yet (e.g. `NowPlayingPage`, before any
   * lookup has resolved a real loved status). */
  readonly initialLoved?: boolean;
  /** Interpolated into each button's aria-label (`Love {trackLabel}`) when several of
   * these controls can appear on screen at once and need to stay distinguishable to
   * assistive tech — e.g. `ScrobbleListItem`, one row among many. Omit for a generic
   * label (`Love this track`) on a single-track page where only one instance ever
   * exists at a time (`NowPlayingPage`, `ScrobbleDetailPage`). */
  readonly trackLabel?: string;
  /** Which side the tag popover opens toward — `"left"` (the default) for controls
   * with more room to their left, `"right"` for controls near a container's right
   * edge (e.g. `ScrobbleListItem`, where opening left would run the popover under the
   * row's own title/artist text). */
  readonly tagPopoverAnchorHorizontal?: "left" | "right";
}

/**
 * The love/tag action pair every track-showing surface in this app offers
 * (`ScrobbleListItem`, `NowPlayingPage`, `ScrobbleDetailPage`) — a heart toggle and a
 * tag button that opens a small popover to submit comma-separated tags, both backed
 * by `useTrackActions`. Lives in `components/shared/` (see that folder's own note in
 * `find-reusable-components`) because it centralizes what was previously three
 * near-identical copies of the same local tag-popover state and success/failure
 * snackbar wiring.
 *
 * Renders only the two buttons plus the (portal-rendered, so its position in this
 * tree doesn't matter) tag `Popover` — no wrapping `Stack`, since each call site lays
 * these out differently alongside its own other content (a "Now Playing" `Chip`, a
 * "View on Last.fm" button, …). Wrap the result in whatever layout the call site
 * already uses for its action row.
 */
export function TrackLoveTagControls({
  artist,
  track,
  initialLoved,
  trackLabel,
  tagPopoverAnchorHorizontal = "left",
}: TrackLoveTagControlsProps): JSX.Element {
  const { loved, submitting, toggleLove, addTags } = useTrackActions(artist, track, initialLoved);
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

  const loveLabel = trackLabel
    ? loved
      ? `Unlove ${trackLabel}`
      : `Love ${trackLabel}`
    : loved
      ? "Unlove this track"
      : "Love this track";
  const tagLabel = trackLabel ? `Add tags to ${trackLabel}` : "Add tags";

  return (
    <>
      <Tooltip title={loved ? "Unlove this track" : "Love this track"}>
        <span>
          <IconButton
            size="small"
            color={loved ? "error" : "default"}
            disabled={submitting}
            onClick={handleToggleLove}
            aria-label={loveLabel}
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
          aria-label={tagLabel}
        >
          <LocalOfferOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(tagAnchor)}
        anchorEl={tagAnchor}
        onClose={closeTagPopover}
        anchorOrigin={{ vertical: "bottom", horizontal: tagPopoverAnchorHorizontal }}
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
    </>
  );
}

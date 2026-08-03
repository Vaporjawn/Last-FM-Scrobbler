import type { JSX } from "react";
import Chip from "@mui/material/Chip";
import type { SxProps, Theme } from "@mui/material/styles";
import { ScrobblingIndicator } from "../ScrobblingIndicator.js";

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export interface PlaybackStatusChipProps {
  readonly nowPlaying: boolean;
  /** When this track was scrobbled — ignored while `nowPlaying` is true. Renders
   * nothing at all (not an empty chip) when both this and `nowPlaying` are absent/
   * false, same as every call site's previous plain-conditional behavior. */
  readonly timestamp: number | undefined;
  /** "Now Playing" (ScrobbleListItem's own track) vs "Scrobbling now" (someone else's,
   * on FriendListItem) — the two existing call sites' labels differ, and neither
   * reads right for the other's context, so this isn't hardcoded. */
  readonly nowPlayingLabel: string;
  readonly sx?: SxProps<Theme>;
}

/**
 * A track row's trailing status indicator: a filled, pulsing-dot `Chip` while
 * `nowPlaying`, or a plain outlined `Chip` showing when it was scrobbled otherwise —
 * previously a `Chip` for the first case but plain `Typography` caption text for the
 * second, on both `ScrobbleListItem` and `FriendListItem`'s activity card
 * byte-for-byte identically apart from the label. Unified into one chip-shaped
 * element for both states, and pulled out here since both rows need the exact same
 * choice between them.
 *
 * `role="status"` on the `nowPlaying` chip specifically (not the timestamp one — a
 * static "when this happened" fact isn't a live status update ARIA's `status` role is
 * for) means assistive tech announces it the moment a row's live state changes,
 * without the caller needing its own wrapping element for that — `FriendListItem`'s
 * activity card used to hand-roll exactly this (a `role="status"` `Box` around a bare
 * `ScrobblingIndicator`) before it adopted this shared chip instead.
 */
export function PlaybackStatusChip({
  nowPlaying,
  timestamp,
  nowPlayingLabel,
  sx,
}: PlaybackStatusChipProps): JSX.Element | null {
  if (nowPlaying) {
    return (
      <Chip
        role="status"
        aria-label={nowPlayingLabel}
        icon={<ScrobblingIndicator />}
        label={nowPlayingLabel}
        size="small"
        color="primary"
        sx={sx}
      />
    );
  }
  if (timestamp !== undefined) {
    return <Chip label={formatTimestamp(timestamp)} size="small" variant="outlined" sx={sx} />;
  }
  return null;
}

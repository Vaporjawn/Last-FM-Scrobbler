import type { JSX } from "react";
import PauseIcon from "@mui/icons-material/Pause";
import StopIcon from "@mui/icons-material/Stop";
import type { PlaybackState } from "@lastfm-scrobbler/shared-types";
import { ScrobblingIndicator } from "../components/ScrobblingIndicator.js";

/**
 * The icon for a playback state on the Now Playing page: the animated equalizer while
 * playing, a pause glyph when paused, and a stop glyph when stopped (also the fallback
 * for any unrecognized state).
 */
export function StateIcon({ state }: { state: PlaybackState }): JSX.Element {
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

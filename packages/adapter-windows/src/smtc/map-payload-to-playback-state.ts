import type { PlaybackState } from "@lastfm-scrobbler/shared-types";
import type { NowPlayingPayload } from "./now-playing-payload.js";

/**
 * Maps SMTC's `PlaybackStatus` enum (as its C# member name string: "Closed" | "Opened" |
 * "Changing" | "Stopped" | "Playing" | "Paused") to `PlaybackState`. Everything besides
 * the two explicit cases — including the three transitional/inactive SMTC-specific
 * statuses this project has no use for — maps to `"stopped"` rather than guessing.
 */
export function mapPayloadToPlaybackState(payload: NowPlayingPayload): PlaybackState {
  if (payload.playbackStatus === "Playing") {
    return "playing";
  }
  if (payload.playbackStatus === "Paused") {
    return "paused";
  }
  return "stopped";
}

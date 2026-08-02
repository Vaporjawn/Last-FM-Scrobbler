import type { PlaybackState } from "@lastfm-scrobbler/shared-types";

/**
 * Maps MPRIS's `PlaybackStatus` property (spec-defined values: `"Playing"`,
 * `"Paused"`, `"Stopped"`) to `PlaybackState`. Anything else — missing, empty, or a
 * value outside the spec (seen in the wild from nonconformant players) — maps to
 * `"stopped"` rather than guessing.
 */
export function mapPlaybackStatus(status: string | undefined): PlaybackState {
  if (status === "Playing") {
    return "playing";
  }
  if (status === "Paused") {
    return "paused";
  }
  return "stopped";
}

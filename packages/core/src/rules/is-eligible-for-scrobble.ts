const MIN_TRACK_DURATION_SEC = 30;
/** Exported for reuse — {@link Tracker} falls back to this alone when duration is unknown. */
export const MAX_ELIGIBILITY_THRESHOLD_SEC = 240;

export interface EligibilityInput {
  /** Omit for sources with no fixed duration (e.g. a live radio stream). */
  readonly durationSec?: number;
  readonly playedSec: number;
}

/**
 * A track is eligible to scrobble once it has been played for at least half its
 * duration, or 240 seconds, whichever is reached first — and only if the track itself
 * is at least 30 seconds long. Matches Last.fm's own scrobbling rules and
 * foo_scrobbler_mac's "≥50% or ≥240s" rule.
 *
 * When `durationSec` is omitted (a stream with no fixed length), the 50%-of-duration
 * half of the rule doesn't apply — eligibility falls back to the 240s cap alone.
 */
export function isEligibleForScrobble(input: EligibilityInput): boolean {
  const { durationSec, playedSec } = input;

  if (durationSec === undefined) {
    return playedSec >= MAX_ELIGIBILITY_THRESHOLD_SEC;
  }

  if (durationSec < MIN_TRACK_DURATION_SEC) {
    return false;
  }

  const threshold = Math.min(durationSec / 2, MAX_ELIGIBILITY_THRESHOLD_SEC);
  return playedSec >= threshold;
}

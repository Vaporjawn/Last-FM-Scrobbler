const MIN_TRACK_DURATION_SEC = 30;
const MAX_ELIGIBILITY_THRESHOLD_SEC = 240;

export interface EligibilityInput {
  readonly durationSec: number;
  readonly playedSec: number;
}

/**
 * A track is eligible to scrobble once it has been played for at least half its
 * duration, or 240 seconds, whichever is reached first — and only if the track itself
 * is at least 30 seconds long. Matches Last.fm's own scrobbling rules and
 * foo_scrobbler_mac's "≥50% or ≥240s" rule.
 */
export function isEligibleForScrobble(input: EligibilityInput): boolean {
  const { durationSec, playedSec } = input;

  if (durationSec < MIN_TRACK_DURATION_SEC) {
    return false;
  }

  const threshold = Math.min(durationSec / 2, MAX_ELIGIBILITY_THRESHOLD_SEC);
  return playedSec >= threshold;
}

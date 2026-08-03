// track.scrobble's per-scrobble ignoredMessage codes.
// 1 Artist ignored, 2 Track ignored: content-based, resubmitting won't change the
//   outcome.
// 3 Timestamp too old, 4 Timestamp too new: the scrobble itself is malformed —
//   matches docs/adr/0006-offline-queue-persistence.md's non-retryable clock-skew case.
// 5 Daily scrobble limit exceeded: not the scrobble's fault, worth retrying later.
const RETRYABLE_SCROBBLE_IGNORE_CODES = new Set([5]);

/**
 * Whether a per-scrobble `ignoredMessage` code (returned alongside an otherwise-
 * successful `track.scrobble` response — see `LastfmClient.scrobble`) represents a
 * transient condition worth retrying, as opposed to a permanent content/timestamp
 * problem that would just be ignored identically on resubmission.
 */
export function isRetryableScrobbleIgnoreCode(code: number): boolean {
  return RETRYABLE_SCROBBLE_IGNORE_CODES.has(code);
}

/** Thrown for any Last.fm API response of the form `{ error, message }`. */
export class LastfmApiError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "LastfmApiError";
    this.code = code;
  }
}

// https://www.last.fm/api/errorcodes
// 8  Operation failed (backend hiccup)
// 11 Service offline
// 16 Temporary error
// 29 Rate limit exceeded
const RETRYABLE_API_ERROR_CODES = new Set([8, 11, 16, 29]);

/**
 * Whether a general Last.fm API error code represents a transient condition worth
 * retrying later, as opposed to a permanent problem (bad request, bad credentials,
 * suspended key, ...) that will just fail identically every time.
 */
export function isRetryableApiErrorCode(code: number): boolean {
  return RETRYABLE_API_ERROR_CODES.has(code);
}

// track.scrobble's per-scrobble ignoredMessage codes.
// 1 Artist ignored, 2 Track ignored: content-based, resubmitting won't change the
//   outcome.
// 3 Timestamp too old, 4 Timestamp too new: the scrobble itself is malformed —
//   matches docs/adr/0006-offline-queue-persistence.md's non-retryable clock-skew case.
// 5 Daily scrobble limit exceeded: not the scrobble's fault, worth retrying later.
const RETRYABLE_SCROBBLE_IGNORE_CODES = new Set([5]);

export function isRetryableScrobbleIgnoreCode(code: number): boolean {
  return RETRYABLE_SCROBBLE_IGNORE_CODES.has(code);
}

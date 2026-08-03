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

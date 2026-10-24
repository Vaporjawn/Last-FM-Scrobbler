/** How long any single outbound HTTP request may take before it is aborted. Without a
 * ceiling, one request to a stalled server never settles, and anything waiting on it (a
 * scrobble drain, a login, a bug report) waits forever with its resources held. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/** An `AbortSignal` that aborts with a `TimeoutError` after `timeoutMs`. It also covers
 * reading the response body, not just waiting for headers. */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

import { isNetworkError } from "./is-network-error.js";
import type { NetworkStatusMonitor } from "./network-status-monitor.js";

/** Shown to the renderer (and, for a failed login, in the native "Login failed"
 * notification) in place of whatever raw technical error a classified connectivity
 * failure actually threw — see `docs/adr/0011-network-status-detection.md`. Copied
 * verbatim at every call site; never paraphrased. */
export const NETWORK_UNAVAILABLE_MESSAGE = "Can't reach Last.fm — check your internet connection.";

/**
 * Wraps a promise from an existing Last.fm/Libre.fm/ListenBrainz call so its outcome
 * also reports to `monitor` — success unconditionally; failure only when
 * `isNetworkError` classifies it as a genuine connectivity failure, in which case the
 * error the caller sees is also replaced with `NETWORK_UNAVAILABLE_MESSAGE` (an
 * application-level failure — a bad session, "artist not found" — passes through
 * completely unchanged, preserving whatever `instanceof` checks a caller already does
 * on it, e.g. `wire-lastfm-data.ts`'s `isNotFoundError`).
 *
 * `monitor` is optional so every call site works unchanged in a context that doesn't
 * have one wired (e.g. an existing test that doesn't care about network-status
 * reporting) — a transparent pass-through in that case.
 */
export function reportNetworkOutcome<T>(
  monitor: NetworkStatusMonitor | undefined,
  promise: Promise<T>,
): Promise<T> {
  if (!monitor) {
    return promise;
  }
  return promise.then(
    (value) => {
      monitor.reportSuccess();
      return value;
    },
    (error: unknown) => {
      if (isNetworkError(error)) {
        monitor.reportFailure(error);
        throw new Error(NETWORK_UNAVAILABLE_MESSAGE);
      }
      throw error;
    },
  );
}

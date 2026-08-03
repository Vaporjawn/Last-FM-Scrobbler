import { useCallback, useEffect, useState } from "react";
import type { UpdateStatus } from "../../../shared/update-status.js";
import type { ActionResult } from "./action-result.js";
import { fail } from "./fail.js";
import { ok } from "./ok.js";

export interface UseUpdatesResult {
  readonly status: UpdateStatus;
  readonly isChecking: boolean;
  readonly error: string | undefined;
  /** Triggers a check immediately, regardless of `AppSettings.autoUpdateEnabled` —
   * see `shared/updates-api.ts`. Note the returned `ActionResult` only reflects
   * whether the *check itself ran*, not whether an update was found; the actual
   * outcome (available/not-available/downloaded/error) arrives separately via
   * `status`. */
  readonly checkNow: () => Promise<ActionResult>;
}

const IDLE: UpdateStatus = { phase: "idle" };
const NOT_AVAILABLE = "Not available right now.";

/**
 * Subscribes to `window.updates` (exposed by the preload script — see
 * `src/shared/updates-api.ts`). Pulls the current status on mount in addition to
 * subscribing to push updates, same reasoning as `useNowPlaying`. Returns idle status
 * and a no-op `checkNow` — never throws — when `window.updates` isn't present, which
 * is expected outside a real Electron renderer (e.g. component tests).
 */
export function useUpdates(): UseUpdatesResult {
  const [status, setStatus] = useState<UpdateStatus>(IDLE);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!window.updates) {
      return;
    }
    let cancelled = false;
    // Set once the push subscription below fires before the pull resolves — once
    // that's happened, the pull's eventually-resolved status is guaranteed stale and
    // must never overwrite it. wireUpdates schedules an auto-check 10s after startup
    // and every 4h (see wire-updates.ts), driven by electron-updater's own async
    // network events entirely independent of any given getStatus() round trip — if a
    // mount's pull is in flight when one of those fires and pushes a real status
    // change (e.g. "available" -> "downloading" -> "downloaded"), and the pull's IPC
    // response happens to land after the push, the UI could revert from a correct
    // "downloaded, restart to apply" status back to a stale "idle"/"checking" one.
    let hasReceivedPush = false;

    window.updates
      .getStatus()
      .then((current) => {
        if (!cancelled && !hasReceivedPush) {
          setStatus(current);
        }
      })
      .catch((getStatusError: unknown) => {
        // Previously only logged, never surfaced via `error` — unlike checkNow below,
        // which does call setError on failure. A rejected initial getStatus() (e.g. a
        // stale preload build missing the method) left `status` at IDLE and `error`
        // at undefined, indistinguishable in the UI from "checked, no update
        // available" — now mirrors checkNow's own pattern so a failed initial check
        // is actually visible as a failure, not silent.
        console.error("Failed to fetch the current update status:", getStatusError);
        if (!cancelled) {
          setError(fail(getStatusError).error);
        }
      });

    const unsubscribe = window.updates.onStatusChanged((next) => {
      hasReceivedPush = true;
      setStatus(next);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const checkNow = useCallback(async (): Promise<ActionResult> => {
    if (!window.updates) {
      return fail(NOT_AVAILABLE);
    }
    try {
      await window.updates.checkNow();
      setError(undefined);
      return ok();
    } catch (checkError) {
      const result = fail(checkError);
      setError(result.error);
      return result;
    }
  }, []);

  return { status, isChecking: status.phase === "checking", error, checkNow };
}

import { useCallback, useEffect, useState } from "react";
import type { UpdateStatus } from "../../../shared/update-status.js";
import { fail, ok, type ActionResult } from "./action-result.js";

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

    window.updates
      .getStatus()
      .then((current) => {
        if (!cancelled) {
          setStatus(current);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to fetch the current update status:", error);
      });

    const unsubscribe = window.updates.onStatusChanged((next) => {
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

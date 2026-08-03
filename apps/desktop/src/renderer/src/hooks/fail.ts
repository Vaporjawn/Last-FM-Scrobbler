import type { ActionFailure } from "./action-result.js";

/** Constructs the failure case of an `ActionResult` — see that type's docstring.
 * Normalizes any thrown/rejected value to a plain string message, since callers only
 * ever need to display it, not inspect the original error's type. */
export function fail(error: unknown): ActionFailure {
  return { success: false, error: error instanceof Error ? error.message : String(error) };
}

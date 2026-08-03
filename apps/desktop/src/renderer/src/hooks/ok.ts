import type { ActionSuccess } from "./action-result.js";

/** Constructs the success case of an `ActionResult` — see that type's docstring. */
export function ok(): ActionSuccess {
  return { success: true };
}

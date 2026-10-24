import type { LibrefmApi } from "../../../shared/secondary-auth-api.js";
import type { ActionResult } from "./action-result.js";
import { fail } from "./fail.js";
import { ok } from "./ok.js";
import { type LibrefmAuthState } from "./librefm-auth-state.js";

const NOT_AVAILABLE = "Not available right now.";
/** Same shape as `use-auth.ts`'s `runAuthAction`, adapted for `LibrefmApi` — see that
 * function's docstring for the full reasoning. */
export async function runLibrefmAction(
  action: (librefm: LibrefmApi) => Promise<unknown>,
  refresh: () => Promise<void>,
  setState: (updater: (previous: LibrefmAuthState) => LibrefmAuthState) => void,
): Promise<ActionResult> {
  if (!window.librefm) {
    return fail(NOT_AVAILABLE);
  }
  try {
    await action(window.librefm);
    await refresh();
    return ok();
  } catch (error) {
    const result = fail(error);
    setState((previous) => ({ ...previous, error: result.error }));
    return result;
  }
}

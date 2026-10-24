import type { AuthApi } from "../../../shared/auth-api.js";
import type { ActionResult } from "./action-result.js";
import { fail } from "./fail.js";
import { ok } from "./ok.js";
import { type AuthState } from "./auth-state.js";

const NOT_AVAILABLE = "Not available right now.";
/**
 * Runs one `window.auth` call, refreshes state from it, and folds any failure into
 * `error` — the shape every write action below (`login`/`logout`/`setActiveAccount`/
 * `saveAppCredentials`/`clearAppCredentials`) shares, previously duplicated once per
 * action. `action` receives the already-verified-non-undefined `AuthApi` so callers
 * don't each need their own `!window.auth` guard or a non-null assertion to satisfy
 * it. Loading flags (`isLoggingIn`/`isSavingCredentials`) are the one thing that
 * differs per action, so those stay in each `useCallback` around this call rather
 * than being parameterized here.
 */
export async function runAuthAction(
  // `Promise<unknown>` rather than `Promise<void>` so callers can pass `auth.login`
  // (which resolves with `{ username }`) directly instead of needing a `.then(() =>
  // {})` adapter just to satisfy the type — the result of `action` is intentionally
  // discarded either way, since every action re-derives fresh state via `refresh()`.
  action: (auth: AuthApi) => Promise<unknown>,
  refresh: () => Promise<void>,
  setState: (updater: (previous: AuthState) => AuthState) => void,
): Promise<ActionResult> {
  if (!window.auth) {
    return fail(NOT_AVAILABLE);
  }
  try {
    await action(window.auth);
    await refresh();
    return ok();
  } catch (error) {
    const result = fail(error);
    setState((previous) => ({ ...previous, error: result.error }));
    return result;
  }
}

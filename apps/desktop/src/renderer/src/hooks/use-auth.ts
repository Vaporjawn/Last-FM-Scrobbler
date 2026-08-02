import { useCallback, useEffect, useState } from "react";
import { fail, ok, type ActionResult } from "./action-result.js";

export interface AuthState {
  /** Whether this build has Last.fm API credentials configured at all. `undefined`
   * while still loading, so callers can distinguish "checking" from "unconfigured". */
  readonly isConfigured: boolean | undefined;
  /** Where the active API key/secret came from — `undefined` while still loading. See
   * `shared/auth-api.ts`. */
  readonly credentialsSource: "environment" | "user-supplied" | "none" | undefined;
  readonly accounts: readonly string[];
  readonly activeAccount: string | undefined;
  readonly isLoggingIn: boolean;
  readonly isSavingCredentials: boolean;
  readonly error: string | undefined;
}

const NOT_AVAILABLE = "Not available right now.";

export interface UseAuthResult extends AuthState {
  readonly login: () => Promise<ActionResult>;
  readonly logout: (username: string) => Promise<ActionResult>;
  readonly setActiveAccount: (username: string) => Promise<ActionResult>;
  /** Saves a user-supplied Last.fm API key/secret pair — the "bring your own key"
   * alternative to a build with credentials baked in. Takes effect on next launch;
   * call `relaunch()` afterward to apply it immediately. */
  readonly saveAppCredentials: (apiKey: string, apiSecret: string) => Promise<ActionResult>;
  /** Clears a previously-saved user-supplied API key/secret pair. */
  readonly clearAppCredentials: () => Promise<ActionResult>;
  /** Restarts the app so newly-saved (or cleared) credentials take effect. */
  readonly relaunch: () => Promise<void>;
}

const INITIAL_STATE: AuthState = {
  isConfigured: undefined,
  credentialsSource: undefined,
  accounts: [],
  activeAccount: undefined,
  isLoggingIn: false,
  isSavingCredentials: false,
  error: undefined,
};

/**
 * Manages Last.fm account state against `window.auth` (see `src/shared/auth-api.ts`).
 * Returns inert defaults — never throws — when `window.auth` isn't present, which is
 * expected outside a real Electron renderer (e.g. component tests).
 */
export function useAuth(): UseAuthResult {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  const refresh = useCallback(async () => {
    if (!window.auth) {
      return;
    }
    try {
      const [isConfigured, credentialsSource, accounts, activeAccount] = await Promise.all([
        window.auth.isConfigured(),
        window.auth.credentialsSource(),
        window.auth.listAccounts(),
        window.auth.getActiveAccount(),
      ]);
      setState((previous) => ({
        ...previous,
        isConfigured,
        credentialsSource,
        accounts,
        activeAccount,
        error: undefined,
      }));
    } catch (refreshError) {
      // If any of the above IPC calls reject (e.g. a stale main process during
      // development — Electron's main process doesn't hot-reload the way the renderer
      // does, so a main-process-only change needs a full restart), fall back to a
      // known, non-loading state instead of leaving `isConfigured` stuck at
      // `undefined` forever, which otherwise reads as an infinite spinner with no
      // indication anything went wrong. `previous.isConfigured ?? false` only forces
      // this on the *first* failed load; a later transient failure (e.g. after
      // clicking "log in") won't downgrade an already-known-good state.
      setState((previous) => ({
        ...previous,
        isConfigured: previous.isConfigured ?? false,
        error: refreshError instanceof Error ? refreshError.message : String(refreshError),
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (): Promise<ActionResult> => {
    if (!window.auth) {
      return fail(NOT_AVAILABLE);
    }
    setState((previous) => ({ ...previous, isLoggingIn: true, error: undefined }));
    try {
      await window.auth.login();
      await refresh();
      return ok();
    } catch (error) {
      const result = fail(error);
      setState((previous) => ({ ...previous, error: result.error }));
      return result;
    } finally {
      setState((previous) => ({ ...previous, isLoggingIn: false }));
    }
  }, [refresh]);

  const logout = useCallback(
    async (username: string): Promise<ActionResult> => {
      if (!window.auth) {
        return fail(NOT_AVAILABLE);
      }
      try {
        await window.auth.logout(username);
        await refresh();
        return ok();
      } catch (error) {
        const result = fail(error);
        setState((previous) => ({ ...previous, error: result.error }));
        return result;
      }
    },
    [refresh],
  );

  const setActiveAccount = useCallback(
    async (username: string): Promise<ActionResult> => {
      if (!window.auth) {
        return fail(NOT_AVAILABLE);
      }
      try {
        await window.auth.setActiveAccount(username);
        await refresh();
        return ok();
      } catch (error) {
        const result = fail(error);
        setState((previous) => ({ ...previous, error: result.error }));
        return result;
      }
    },
    [refresh],
  );

  const saveAppCredentials = useCallback(
    async (apiKey: string, apiSecret: string): Promise<ActionResult> => {
      if (!window.auth) {
        return fail(NOT_AVAILABLE);
      }
      setState((previous) => ({ ...previous, isSavingCredentials: true, error: undefined }));
      try {
        await window.auth.setAppCredentials(apiKey, apiSecret);
        await refresh();
        return ok();
      } catch (error) {
        const result = fail(error);
        setState((previous) => ({ ...previous, error: result.error }));
        return result;
      } finally {
        setState((previous) => ({ ...previous, isSavingCredentials: false }));
      }
    },
    [refresh],
  );

  const clearAppCredentials = useCallback(async (): Promise<ActionResult> => {
    if (!window.auth) {
      return fail(NOT_AVAILABLE);
    }
    try {
      await window.auth.clearAppCredentials();
      await refresh();
      return ok();
    } catch (error) {
      const result = fail(error);
      setState((previous) => ({ ...previous, error: result.error }));
      return result;
    }
  }, [refresh]);

  const relaunch = useCallback(async () => {
    if (!window.auth) {
      return;
    }
    await window.auth.relaunch();
  }, []);

  return {
    ...state,
    login,
    logout,
    setActiveAccount,
    saveAppCredentials,
    clearAppCredentials,
    relaunch,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult } from "./action-result.js";
import { type AuthState } from "./auth-state.js";
import { runAuthAction } from "./run-auth-action.js";

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
  // Bumped on every refresh() call and checked before either branch below applies its
  // result — the underlying main handlers do real I/O (OS keychain reads/writes via
  // AccountStore), so out-of-order resolution across two overlapping refresh() calls
  // is realistic, not theoretical. Without this, e.g. clicking "switch to alice" then
  // quickly clicking "log out" on a different account row (neither button is
  // `disabled` while the other's refresh() is in flight) could have the second,
  // correct call's result clobbered by the first, stale one resolving later —
  // silently reverting the displayed account list/active account. Same pattern
  // use-lastfm-fetch.ts already uses for its own stale-response protection.
  const refreshGenerationRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!window.auth) {
      return;
    }
    const myGeneration = (refreshGenerationRef.current += 1);
    try {
      const [isConfigured, credentialsSource, accounts, activeAccount] = await Promise.all([
        window.auth.isConfigured(),
        window.auth.credentialsSource(),
        window.auth.listAccounts(),
        window.auth.getActiveAccount(),
      ]);
      if (refreshGenerationRef.current !== myGeneration) {
        return; // Superseded by a newer refresh() call — this result is stale.
      }
      setState((previous) => ({
        ...previous,
        isConfigured,
        credentialsSource,
        accounts,
        activeAccount,
        error: undefined,
      }));
    } catch (refreshError) {
      if (refreshGenerationRef.current !== myGeneration) {
        return;
      }
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
    setState((previous) => ({ ...previous, isLoggingIn: true, error: undefined }));
    try {
      return await runAuthAction((auth) => auth.login(), refresh, setState);
    } finally {
      setState((previous) => ({ ...previous, isLoggingIn: false }));
    }
  }, [refresh]);

  const logout = useCallback(
    (username: string): Promise<ActionResult> => {
      return runAuthAction((auth) => auth.logout(username), refresh, setState);
    },
    [refresh],
  );

  const setActiveAccount = useCallback(
    (username: string): Promise<ActionResult> => {
      return runAuthAction((auth) => auth.setActiveAccount(username), refresh, setState);
    },
    [refresh],
  );

  const saveAppCredentials = useCallback(
    async (apiKey: string, apiSecret: string): Promise<ActionResult> => {
      setState((previous) => ({ ...previous, isSavingCredentials: true, error: undefined }));
      try {
        return await runAuthAction(
          (auth) => auth.setAppCredentials(apiKey, apiSecret),
          refresh,
          setState,
        );
      } finally {
        setState((previous) => ({ ...previous, isSavingCredentials: false }));
      }
    },
    [refresh],
  );

  const clearAppCredentials = useCallback((): Promise<ActionResult> => {
    return runAuthAction((auth) => auth.clearAppCredentials(), refresh, setState);
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

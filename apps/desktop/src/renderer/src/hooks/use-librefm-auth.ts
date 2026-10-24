import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult } from "./action-result.js";
import { type LibrefmAuthState } from "./librefm-auth-state.js";
import { runLibrefmAction } from "./run-librefm-action.js";

export interface UseLibrefmAuthResult extends LibrefmAuthState {
  readonly login: () => Promise<ActionResult>;
  readonly logout: () => Promise<ActionResult>;
  /** Saves a Libre.fm API key/secret pair — takes effect immediately, no relaunch
   * needed (see `LibrefmApi.setCredentials`'s docstring). */
  readonly saveCredentials: (apiKey: string, apiSecret: string) => Promise<ActionResult>;
  readonly clearCredentials: () => Promise<ActionResult>;
}
const INITIAL_STATE: LibrefmAuthState = {
  isConfigured: undefined,
  credentialsSource: undefined,
  activeAccount: undefined,
  isLoggingIn: false,
  isSavingCredentials: false,
  error: undefined,
};
/**
 * Manages Libre.fm account state against `window.librefm` (see
 * `src/shared/secondary-auth-api.ts`). Returns inert defaults — never throws — when
 * `window.librefm` isn't present, same convention as `useAuth`.
 */
export function useLibrefmAuth(): UseLibrefmAuthResult {
  const [state, setState] = useState<LibrefmAuthState>(INITIAL_STATE);
  // Same generation-ref stale-response guard as useAuth's own refresh() — see that
  // hook's docstring for the full reasoning (concurrent login()/logout() calls racing
  // against real keychain I/O).
  const refreshGenerationRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!window.librefm) {
      return;
    }
    const myGeneration = (refreshGenerationRef.current += 1);
    try {
      const [isConfigured, credentialsSource, activeAccount] = await Promise.all([
        window.librefm.isConfigured(),
        window.librefm.credentialsSource(),
        window.librefm.getActiveAccount(),
      ]);
      if (refreshGenerationRef.current !== myGeneration) {
        return; // Superseded by a newer refresh() call — this result is stale.
      }
      setState((previous) => ({
        ...previous,
        isConfigured,
        credentialsSource,
        activeAccount,
        error: undefined,
      }));
    } catch (refreshError) {
      if (refreshGenerationRef.current !== myGeneration) {
        return;
      }
      // Same "fall back to a known state instead of an infinite spinner" reasoning as
      // useAuth's own refresh() catch block.
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
      return await runLibrefmAction((librefm) => librefm.login(), refresh, setState);
    } finally {
      setState((previous) => ({ ...previous, isLoggingIn: false }));
    }
  }, [refresh]);

  const logout = useCallback((): Promise<ActionResult> => {
    return runLibrefmAction((librefm) => librefm.logout(), refresh, setState);
  }, [refresh]);

  const saveCredentials = useCallback(
    async (apiKey: string, apiSecret: string): Promise<ActionResult> => {
      setState((previous) => ({ ...previous, isSavingCredentials: true, error: undefined }));
      try {
        return await runLibrefmAction(
          (librefm) => librefm.setCredentials(apiKey, apiSecret),
          refresh,
          setState,
        );
      } finally {
        setState((previous) => ({ ...previous, isSavingCredentials: false }));
      }
    },
    [refresh],
  );

  const clearCredentials = useCallback((): Promise<ActionResult> => {
    return runLibrefmAction((librefm) => librefm.clearCredentials(), refresh, setState);
  }, [refresh]);

  return { ...state, login, logout, saveCredentials, clearCredentials };
}

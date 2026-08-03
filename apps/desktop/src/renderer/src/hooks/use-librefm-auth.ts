import { useCallback, useEffect, useRef, useState } from "react";
import type { LibrefmApi } from "../../../shared/secondary-auth-api.js";
import type { ActionResult } from "./action-result.js";
import { fail } from "./fail.js";
import { ok } from "./ok.js";

export interface LibrefmAuthState {
  /** Whether a Libre.fm API key/secret pair is available at all right now (baked in
   * or saved). `undefined` while still loading, so callers can distinguish "checking"
   * from "unconfigured" — same convention as `useAuth`'s `isConfigured`. */
  readonly isConfigured: boolean | undefined;
  /** Where the active key/secret came from — `undefined` while still loading. See
   * `shared/secondary-auth-api.ts`. */
  readonly credentialsSource: "environment" | "user-supplied" | "none" | undefined;
  /** The connected Libre.fm account's username, or `undefined` if none is connected.
   * Unlike `useAuth`, there's no `accounts` list/`setActiveAccount` — Libre.fm
   * connects at most one account at a time (see `LibrefmApi`'s docstring). */
  readonly activeAccount: string | undefined;
  readonly isLoggingIn: boolean;
  readonly isSavingCredentials: boolean;
  readonly error: string | undefined;
}

const NOT_AVAILABLE = "Not available right now.";

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

/** Same shape as `use-auth.ts`'s `runAuthAction`, adapted for `LibrefmApi` — see that
 * function's docstring for the full reasoning. */
async function runLibrefmAction(
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

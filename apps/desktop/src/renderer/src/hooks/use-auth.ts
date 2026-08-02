import { useCallback, useEffect, useState } from "react";

export interface AuthState {
  /** Whether this build has Last.fm API credentials configured at all. `undefined`
   * while still loading, so callers can distinguish "checking" from "unconfigured". */
  readonly isConfigured: boolean | undefined;
  readonly accounts: readonly string[];
  readonly activeAccount: string | undefined;
  readonly isLoggingIn: boolean;
  readonly error: string | undefined;
}

export interface UseAuthResult extends AuthState {
  readonly login: () => Promise<void>;
  readonly logout: (username: string) => Promise<void>;
  readonly setActiveAccount: (username: string) => Promise<void>;
}

const INITIAL_STATE: AuthState = {
  isConfigured: undefined,
  accounts: [],
  activeAccount: undefined,
  isLoggingIn: false,
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
    const [isConfigured, accounts, activeAccount] = await Promise.all([
      window.auth.isConfigured(),
      window.auth.listAccounts(),
      window.auth.getActiveAccount(),
    ]);
    setState((previous) => ({ ...previous, isConfigured, accounts, activeAccount }));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async () => {
    if (!window.auth) {
      return;
    }
    setState((previous) => ({ ...previous, isLoggingIn: true, error: undefined }));
    try {
      await window.auth.login();
      await refresh();
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setState((previous) => ({ ...previous, isLoggingIn: false }));
    }
  }, [refresh]);

  const logout = useCallback(
    async (username: string) => {
      if (!window.auth) {
        return;
      }
      await window.auth.logout(username);
      await refresh();
    },
    [refresh],
  );

  const setActiveAccount = useCallback(
    async (username: string) => {
      if (!window.auth) {
        return;
      }
      await window.auth.setActiveAccount(username);
      await refresh();
    },
    [refresh],
  );

  return { ...state, login, logout, setActiveAccount };
}

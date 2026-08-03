import { useCallback, useEffect, useState } from "react";
import { fail, ok, type ActionResult } from "./action-result.js";

export interface ListenBrainzAuthState {
  /** The connected ListenBrainz account's username, or `undefined` if none is
   * connected. `undefined` also covers "still loading" — unlike `useAuth`'s
   * `isConfigured`, there's no separate "is this build set up at all" question here:
   * ListenBrainz needs no app-level API key, just a per-user token (see
   * `ListenBrainzApi`'s docstring), so `window.listenbrainz` being present is the only
   * precondition. */
  readonly activeAccount: string | undefined;
  readonly isConnecting: boolean;
  readonly error: string | undefined;
}

const NOT_AVAILABLE = "Not available right now.";

export interface UseListenBrainzAuthResult extends ListenBrainzAuthState {
  /** Validates `token` and connects the account it belongs to. */
  readonly connect: (token: string) => Promise<ActionResult>;
  readonly disconnect: () => Promise<ActionResult>;
}

const INITIAL_STATE: ListenBrainzAuthState = {
  activeAccount: undefined,
  isConnecting: false,
  error: undefined,
};

/**
 * Manages ListenBrainz account state against `window.listenbrainz` (see
 * `src/shared/secondary-auth-api.ts`). Returns inert defaults — never throws — when
 * `window.listenbrainz` isn't present, same convention as `useAuth`/`useLibrefmAuth`.
 */
export function useListenBrainzAuth(): UseListenBrainzAuthResult {
  const [state, setState] = useState<ListenBrainzAuthState>(INITIAL_STATE);

  const refresh = useCallback(async () => {
    if (!window.listenbrainz) {
      return;
    }
    try {
      const activeAccount = await window.listenbrainz.getActiveAccount();
      setState((previous) => ({ ...previous, activeAccount, error: undefined }));
    } catch (refreshError) {
      setState((previous) => ({
        ...previous,
        error: refreshError instanceof Error ? refreshError.message : String(refreshError),
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(
    async (token: string): Promise<ActionResult> => {
      if (!window.listenbrainz) {
        return fail(NOT_AVAILABLE);
      }
      setState((previous) => ({ ...previous, isConnecting: true, error: undefined }));
      try {
        await window.listenbrainz.connect(token);
        await refresh();
        return ok();
      } catch (error) {
        const result = fail(error);
        setState((previous) => ({ ...previous, error: result.error }));
        return result;
      } finally {
        setState((previous) => ({ ...previous, isConnecting: false }));
      }
    },
    [refresh],
  );

  const disconnect = useCallback(async (): Promise<ActionResult> => {
    if (!window.listenbrainz) {
      return fail(NOT_AVAILABLE);
    }
    try {
      await window.listenbrainz.disconnect();
      await refresh();
      return ok();
    } catch (error) {
      const result = fail(error);
      setState((previous) => ({ ...previous, error: result.error }));
      return result;
    }
  }, [refresh]);

  return { ...state, connect, disconnect };
}

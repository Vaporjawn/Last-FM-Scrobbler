import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult } from "./action-result.js";
import { fail } from "./fail.js";
import { ok } from "./ok.js";

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
  // Same generation-ref stale-response guard as useAuth's own refresh() — see that
  // hook's docstring for the full reasoning (concurrent connect()/disconnect() calls
  // racing against real keychain I/O).
  const refreshGenerationRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!window.listenbrainz) {
      return;
    }
    const myGeneration = (refreshGenerationRef.current += 1);
    try {
      const activeAccount = await window.listenbrainz.getActiveAccount();
      if (refreshGenerationRef.current !== myGeneration) {
        return; // Superseded by a newer refresh() call — this result is stale.
      }
      setState((previous) => ({ ...previous, activeAccount, error: undefined }));
    } catch (refreshError) {
      if (refreshGenerationRef.current !== myGeneration) {
        return;
      }
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

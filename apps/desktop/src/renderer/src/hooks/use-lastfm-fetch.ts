import { useEffect, useState } from "react";

interface FetchState<TData> {
  readonly data: TData;
  readonly loading: boolean;
  readonly error: string | undefined;
}

/**
 * Shared fetch-on-mount-and-dependency-change logic behind `useFriends`,
 * `useRecentTracks`, `useTopArtists`, and `useUserProfile` — all four call one
 * `window.lastfm` method keyed by username, guard identically against that method
 * being unavailable (no active account yet, or `window.lastfm` itself absent outside
 * a real Electron renderer), track an in-flight `cancelled` flag so a stale response
 * can't clobber a newer one after `deps` change again mid-fetch, and reset to
 * `emptyData` whenever fetching is unavailable or a call fails.
 *
 * Each of those four hooks keeps its own public state shape (`{friends}`, `{tracks}`,
 * `{artists}`, `{profile}` — never a generic `data` field) and its own JSDoc; this
 * only factors out the effect body, which was otherwise byte-for-byte identical
 * across all four except for the field name and which `window.lastfm` method ran.
 *
 * `call` is `undefined` (rather than the hook receiving `username` directly) when
 * fetching isn't currently possible — letting each call site fold its own
 * `!username || !window.lastfm` guard, and any other per-hook precondition, into one
 * boolean before deciding whether there's a function to call at all.
 */
export function useLastfmFetch<TData>(
  emptyData: TData,
  call: (() => Promise<TData>) | undefined,
  deps: readonly unknown[],
): FetchState<TData> {
  const [state, setState] = useState<FetchState<TData>>({
    data: emptyData,
    loading: false,
    error: undefined,
  });

  useEffect(() => {
    if (!call) {
      setState({ data: emptyData, loading: false, error: undefined });
      return;
    }
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: undefined }));

    call()
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: undefined });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            data: emptyData,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // `deps` is caller-supplied on purpose (see each hook's own effect dependency
    // array) — this effect's only job is to re-run exactly when the caller's own
    // fetch inputs change, not to re-derive that list itself. No disable comment
    // needed here: this project doesn't have eslint-plugin-react-hooks installed or
    // configured (verified — grep finds no other use of that rule anywhere in this
    // codebase), so there's no `exhaustive-deps` rule active to suppress.
  }, deps);

  return state;
}

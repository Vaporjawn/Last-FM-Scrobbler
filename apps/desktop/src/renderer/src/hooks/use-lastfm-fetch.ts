import { useCallback, useEffect, useRef, useState } from "react";

interface FetchState<TData> {
  readonly data: TData;
  readonly loading: boolean;
  /** True only while a manually-triggered `refetch()` is in flight — kept separate
   * from `loading` so callers can show a small spinner on a refresh control instead
   * of replacing already-loaded content with a full loading state, same reasoning as
   * `useRecentTracks.loadingMore`. */
  readonly refreshing: boolean;
  readonly error: string | undefined;
}

export interface LastfmFetchState<TData> extends FetchState<TData> {
  /** Re-runs the same `call` this hook was given, without waiting for `deps` to
   * change. A no-op while `call` is `undefined` (fetching isn't currently possible)
   * or another fetch (initial, dependency-triggered, or another `refetch`) is already
   * in flight. On failure, keeps whatever `data` is already showing rather than
   * resetting to `emptyData` — a failed manual refresh shouldn't wipe out content the
   * user was already looking at, it should just let them try again (same reasoning
   * as `useRecentTracks.loadMore`'s own failure handling). */
  readonly refetch: () => void;
}

/**
 * Shared fetch-on-mount-and-dependency-change logic behind `useFriends`,
 * `useTopArtists`, `useTopAlbums`, `useTopTracks`, `useUserProfile`, and
 * `useLovedTracksCount` — all call one `window.lastfm` method keyed by username,
 * guard identically against that method being unavailable (no active account yet, or
 * `window.lastfm` itself absent outside a real Electron renderer), track an in-flight
 * fetch so a stale response can't clobber a newer one after `deps` change (or
 * `refetch` fires) again mid-fetch, and reset to `emptyData` whenever fetching is
 * unavailable or the initial/dependency-triggered fetch fails.
 *
 * Each hook built on this keeps its own public state shape (`{friends}`, `{artists}`,
 * `{profile}` — never a generic `data` field) and its own JSDoc; this only factors out
 * the fetch body (now including manual refresh), which was otherwise byte-for-byte
 * identical across every caller except for the field name and which `window.lastfm`
 * method ran.
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
): LastfmFetchState<TData> {
  const [state, setState] = useState<FetchState<TData>>({
    data: emptyData,
    loading: false,
    refreshing: false,
    error: undefined,
  });
  // Bumped on every dependency change (the top of the effect below), so a `refetch()`
  // — or the effect's own fetch — that's still in flight once `deps` change again can
  // recognize itself as stale once it resolves and silently drop its result instead of
  // clobbering state that by then belongs to a completely different `call`. Same
  // pattern as `useRecentTracks`'s own `generationRef`.
  const generationRef = useRef(0);
  // Whether a fetch (initial, dependency-triggered, or a manual `refetch`) is
  // currently in flight — a ref, not state, since `refetch` needs to read the latest
  // value synchronously at click time without itself needing to change identity
  // whenever a fetch starts or ends.
  const fetchingRef = useRef(false);
  // `refetch` has a stable identity (`useCallback` with no deps, so callers can safely
  // pass it into another hook's own dependency array without it changing every
  // render) — this ref lets it always invoke whichever `call` is current as of the
  // click, not whichever `call` closed over it on this hook's first render.
  const callRef = useRef(call);
  callRef.current = call;

  useEffect(() => {
    generationRef.current += 1;
    const myGeneration = generationRef.current;
    fetchingRef.current = false;

    if (!call) {
      setState({ data: emptyData, loading: false, refreshing: false, error: undefined });
      return;
    }

    fetchingRef.current = true;
    setState((previous) => ({ ...previous, loading: true, refreshing: false, error: undefined }));

    // `Promise.resolve().then(call)` rather than calling `call()` directly: if `call`
    // throws synchronously — e.g. a stale preload build where `window.lastfm` exists
    // but a given method hasn't been exposed yet, so invoking it throws a plain
    // TypeError immediately rather than returning a rejected promise — a bare
    // `call().then(...).catch(...)` would never reach `.catch` at all (there's no
    // promise to attach it to), leaving `loading: true` set forever with no way to
    // recover short of a full reload. Routing the call through an already-resolved
    // promise means ANY failure, sync or async, ends up as a normal rejection this
    // hook's own `.catch` below already handles.
    Promise.resolve()
      .then(call)
      .then((data) => {
        if (generationRef.current !== myGeneration) {
          return;
        }
        fetchingRef.current = false;
        setState({ data, loading: false, refreshing: false, error: undefined });
      })
      .catch((error: unknown) => {
        if (generationRef.current !== myGeneration) {
          return;
        }
        fetchingRef.current = false;
        setState({
          data: emptyData,
          loading: false,
          refreshing: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    // `deps` is caller-supplied on purpose (see each hook's own effect dependency
    // array) — this effect's only job is to re-run exactly when the caller's own
    // fetch inputs change, not to re-derive that list itself. No disable comment
    // needed here: this project doesn't have eslint-plugin-react-hooks installed or
    // configured (verified — grep finds no other use of that rule anywhere in this
    // codebase), so there's no `exhaustive-deps` rule active to suppress.
  }, deps);

  const refetch = useCallback(() => {
    const currentCall = callRef.current;
    if (!currentCall || fetchingRef.current) {
      return;
    }
    fetchingRef.current = true;
    const myGeneration = generationRef.current;
    setState((previous) => ({ ...previous, refreshing: true, error: undefined }));

    Promise.resolve()
      .then(currentCall)
      .then((data) => {
        if (generationRef.current !== myGeneration) {
          return;
        }
        fetchingRef.current = false;
        setState({ data, loading: false, refreshing: false, error: undefined });
      })
      .catch((error: unknown) => {
        if (generationRef.current !== myGeneration) {
          return;
        }
        fetchingRef.current = false;
        setState((previous) => ({
          ...previous,
          refreshing: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      });
  }, []);

  return { ...state, refetch };
}

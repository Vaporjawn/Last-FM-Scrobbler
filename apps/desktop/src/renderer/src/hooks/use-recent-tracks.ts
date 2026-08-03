import { useCallback, useEffect, useRef, useState } from "react";
import type { RecentTrack } from "@lastfm-scrobbler/core";

export interface RecentTracksState {
  readonly tracks: readonly RecentTrack[];
  /** True only while the first page (of a fresh `username`/`limit`) is in flight —
   * same meaning every other Last.fm-fetch hook's own `loading` has, so a full-page
   * loading state still works unchanged. */
  readonly loading: boolean;
  /** True only while an additional page (via `loadMore`) is in flight — kept separate
   * from `loading` so callers can show a small inline indicator next to a "Load more"
   * control instead of replacing the whole, already-populated list with a spinner. */
  readonly loadingMore: boolean;
  readonly error: string | undefined;
  /** Whether another page is worth trying. A heuristic, not something Last.fm states
   * directly for this response shape the way `@attr.totalPages` would (this client
   * doesn't parse that field — see `LastfmClient.getRecentTracks`): the most recently
   * fetched page came back with fewer than `limit` tracks, the standard signal there's
   * nothing left. Also `false` whenever `username`/`window.lastfm` aren't available. */
  readonly hasMore: boolean;
  /** Fetches and appends the next page. A no-op while a fetch (initial or another
   * `loadMore`) is already in flight, or once `hasMore` is `false`. */
  readonly loadMore: () => void;
  /** True only while a manual `refetch()` is in flight — kept separate from `loading`
   * so callers can show a small spinner on a refresh control instead of replacing an
   * already-populated list with a full loading state, same reasoning as
   * `loadingMore`. */
  readonly refreshing: boolean;
  /** Re-fetches page 1 for the same `username`/`limit`, discarding any additional
   * pages accumulated via `loadMore` — "start over with fresh data," the same thing a
   * fresh `username`/`limit` change already does, just triggered manually instead of
   * by a dependency change. A no-op while another fetch (initial, `loadMore`, or
   * another `refetch`) is already in flight. */
  readonly refetch: () => void;
}

const EMPTY_TRACKS: readonly RecentTrack[] = [];

/**
 * Fetches `user.getRecentTracks` for `username` via `window.lastfm`, accumulating
 * pages via `loadMore` rather than replacing them — a "Load more" / infinite-scroll
 * style UI, not a page-N-of-M pager: `ScrobblesPage` has no natural place for page
 * numbers (its list is a live, ever-growing scrobble history, not a fixed dataset),
 * and accumulating keeps a user's scroll position stable across a `loadMore` the way
 * swapping the whole list out from under them wouldn't. The trade-off: this hook holds
 * every page fetched so far in memory for as long as the component using it stays
 * mounted (unlike a page-N-of-M pager, which only ever holds one page) — acceptable
 * here since `ScrobblesPage`'s own search box (see `matchesSearch`) already needs the
 * full accumulated list in memory anyway to filter it client-side, and Last.fm's own
 * per-page payload is small.
 *
 * Resets back to page 1 (discarding any accumulated pages) whenever `username` or
 * `limit` changes — same "fresh start on changed inputs" behavior every other
 * Last.fm-fetch hook in this app has, just with an explicit `loadMore` step layered on
 * top instead of a single one-shot fetch.
 */
export function useRecentTracks(username: string | undefined, limit = 20): RecentTracksState {
  const [tracks, setTracks] = useState<readonly RecentTrack[]>(EMPTY_TRACKS);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  // Which page has already been fetched, and whether a fetch (initial or loadMore) is
  // currently in flight — refs, not state, since neither should itself trigger a
  // re-render; `loadMore` reads and writes them directly between renders.
  const pageRef = useRef(1);
  const fetchingRef = useRef(false);
  // Bumped on every fresh `username`/`limit` start, so a `loadMore` fetch that was
  // already in flight when the inputs changed again can recognize itself as stale
  // once it resolves and silently drop its result instead of appending onto (or
  // overwriting error/loading state for) what is by then a completely different
  // user's list.
  const generationRef = useRef(0);

  useEffect(() => {
    generationRef.current += 1;
    const myGeneration = generationRef.current;
    pageRef.current = 1;
    fetchingRef.current = false;

    const lastfm = window.lastfm;
    if (!username || !lastfm) {
      setTracks(EMPTY_TRACKS);
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      setError(undefined);
      setHasMore(false);
      return;
    }

    setLoading(true);
    setLoadingMore(false);
    setRefreshing(false);
    setError(undefined);
    fetchingRef.current = true;

    // `Promise.resolve().then(...)` rather than calling `lastfm.getRecentTracks`
    // directly — see `useLastfmFetch`'s own docstring for why routing every call
    // through an already-resolved promise matters: it turns a synchronous throw (a
    // stale preload build missing this method) into a normal rejection this hook's
    // own `.catch` already handles, instead of leaving `loading` stuck forever.
    Promise.resolve()
      .then(() => lastfm.getRecentTracks(username, limit, 1))
      .then((page) => {
        if (generationRef.current !== myGeneration) {
          return;
        }
        setTracks(page);
        setHasMore(page.length >= limit && page.length > 0);
        setLoading(false);
        fetchingRef.current = false;
      })
      .catch((err: unknown) => {
        if (generationRef.current !== myGeneration) {
          return;
        }
        setTracks(EMPTY_TRACKS);
        setHasMore(false);
        setLoading(false);
        setError(err instanceof Error ? err.message : String(err));
        fetchingRef.current = false;
      });
  }, [username, limit]);

  const loadMore = useCallback(() => {
    const lastfm = window.lastfm;
    if (!username || !lastfm || fetchingRef.current || !hasMore) {
      return;
    }
    const myGeneration = generationRef.current;
    const nextPage = pageRef.current + 1;
    fetchingRef.current = true;
    setLoadingMore(true);
    setError(undefined);

    Promise.resolve()
      .then(() => lastfm.getRecentTracks(username, limit, nextPage))
      .then((page) => {
        if (generationRef.current !== myGeneration) {
          return;
        }
        pageRef.current = nextPage;
        setTracks((previous) => [...previous, ...page]);
        setHasMore(page.length >= limit && page.length > 0);
        setLoadingMore(false);
        fetchingRef.current = false;
      })
      .catch((err: unknown) => {
        if (generationRef.current !== myGeneration) {
          return;
        }
        // Deliberately keeps the already-accumulated `tracks` and current `hasMore`
        // as-is on failure (rather than clearing them, the way the initial fetch's
        // own catch above does) — a failed loadMore shouldn't wipe out a list the
        // user was already looking at; it should just let them try loadMore again.
        setLoadingMore(false);
        setError(err instanceof Error ? err.message : String(err));
        fetchingRef.current = false;
      });
  }, [username, limit, hasMore]);

  const refetch = useCallback(() => {
    const lastfm = window.lastfm;
    if (!username || !lastfm || fetchingRef.current) {
      return;
    }
    const myGeneration = generationRef.current;
    fetchingRef.current = true;
    setRefreshing(true);
    setError(undefined);

    Promise.resolve()
      .then(() => lastfm.getRecentTracks(username, limit, 1))
      .then((page) => {
        if (generationRef.current !== myGeneration) {
          return;
        }
        pageRef.current = 1;
        setTracks(page);
        setHasMore(page.length >= limit && page.length > 0);
        setRefreshing(false);
        fetchingRef.current = false;
      })
      .catch((err: unknown) => {
        if (generationRef.current !== myGeneration) {
          return;
        }
        // Deliberately keeps the already-loaded `tracks` and current `hasMore` as-is
        // on failure, same reasoning as `loadMore`'s own catch above — a failed
        // refresh shouldn't wipe out a list the user was already looking at.
        setRefreshing(false);
        setError(err instanceof Error ? err.message : String(err));
        fetchingRef.current = false;
      });
  }, [username, limit]);

  return { tracks, loading, loadingMore, refreshing, error, hasMore, loadMore, refetch };
}

import { useLastfmFetch } from "./use-lastfm-fetch.js";

export interface ArtistTopTagsState {
  readonly tags: readonly string[];
  readonly refreshing: boolean;
  /** Re-fetches `artist.getTopTags` for the same `artistName` — see
   * `LastfmFetchState.refetch`'s docstring. */
  readonly refetch: () => void;
}

const EMPTY_TAGS: readonly string[] = [];

/**
 * Fetches `artist.getTopTags` for `artistName` via `window.lastfm` (see
 * `src/shared/lastfm-api.ts`) — the "Popular Tags" row on ScrobbleDetailPage's artist
 * panel (see `ArtistInfoPanel`'s `topTags` prop). Public, unsigned endpoint. Resolves
 * to `EMPTY_TAGS` — never throws — when `artistName` is undefined or `window.lastfm`
 * isn't present; failures resolve the same way rather than surfacing a separate error
 * state, since a missing tag list isn't worth interrupting the rest of the page over
 * (same reasoning as `fetchArtistImageUrl`'s best-effort contract).
 */
export function useArtistTopTags(artistName: string | undefined): ArtistTopTagsState {
  const lastfm = window.lastfm;
  const call = artistName && lastfm ? () => lastfm.getTopTags(artistName) : undefined;
  const { data, refreshing, refetch } = useLastfmFetch(EMPTY_TAGS, call, [artistName]);
  return { tags: data, refreshing, refetch };
}

import { useEffect, useState } from "react";

/**
 * Fetches `artist.getTopTags` for `artistName` via `window.lastfm` (see
 * `src/shared/lastfm-api.ts`) — the "Popular Tags" row on ScrobbleDetailPage's artist
 * panel (see `ArtistInfoPanel`'s `topTags` prop). Public, unsigned endpoint. Returns
 * an empty array — never throws — when `artistName` is undefined or `window.lastfm`
 * isn't present; failures resolve the same way rather than surfacing a separate error
 * state, since a missing tag list isn't worth interrupting the rest of the page over
 * (same reasoning as `fetchArtistImageUrl`'s best-effort contract).
 */
export function useArtistTopTags(artistName: string | undefined): readonly string[] {
  const [tags, setTags] = useState<readonly string[]>([]);

  useEffect(() => {
    if (!artistName || !window.lastfm) {
      setTags([]);
      return;
    }
    let cancelled = false;

    window.lastfm
      .getTopTags(artistName)
      .then((result) => {
        if (!cancelled) {
          setTags(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTags([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [artistName]);

  return tags;
}

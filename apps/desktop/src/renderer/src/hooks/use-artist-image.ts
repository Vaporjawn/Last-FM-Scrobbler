import { useEffect, useState } from "react";

/**
 * Fetches a real per-artist photo via `window.artistImage` (see
 * `src/shared/artist-image-api.ts` — backed by Deezer's public artist search, not
 * Last.fm; see `packages/core`'s `fetchArtistImageUrl` for why). Returns `undefined`
 * — never throws — while loading, when `artistName` is undefined, when
 * `window.artistImage` isn't present, or when no real photo was found; callers should
 * treat `undefined` as "show the letter-avatar fallback", not as an error state (see
 * `fetchArtistImageUrl`'s docstring — a missing photo is an expected, common, and
 * silently-handled outcome, not a failure).
 */
export function useArtistImage(artistName: string | undefined): string | undefined {
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!artistName || !window.artistImage) {
      setImageUrl(undefined);
      return;
    }
    let cancelled = false;

    window.artistImage
      .getUrl(artistName)
      .then((url) => {
        if (!cancelled) {
          setImageUrl(url);
        }
      })
      .catch(() => {
        // `getUrl` is documented never to reject — this only guards against something
        // unexpected at the IPC layer itself, matching every other hook in this app's
        // "never throws" contract. Same outcome as "no photo found": fall back to the
        // letter-avatar, silently.
        if (!cancelled) {
          setImageUrl(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [artistName]);

  return imageUrl;
}

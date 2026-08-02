/**
 * The renderer-facing artist-photo API the preload script exposes via
 * `contextBridge.exposeInMainWorld("artistImage", ...)`. Deliberately a separate
 * surface from `LastfmDataApi` (`shared/lastfm-api.ts`) rather than another
 * `lastfm.*` method — this is backed by Deezer's public artist search, not Last.fm
 * (see `packages/core`'s `fetchArtistImageUrl` and `ArtistInfo`'s docstring for why:
 * Last.fm's own artist-image field is a shared placeholder, not a real photo). Naming
 * it `lastfm.*` would misrepresent where the image actually comes from.
 */
export interface ArtistImageApi {
  /** Resolves to a real photo URL, or `undefined` if none was found (or the lookup
   * failed) — see `fetchArtistImageUrl`'s docstring for the full best-effort
   * contract. Never rejects. */
  getUrl(artistName: string): Promise<string | undefined>;
}

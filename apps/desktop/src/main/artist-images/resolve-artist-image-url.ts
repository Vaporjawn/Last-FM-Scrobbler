import { fetchArtistImageUrl } from "@lastfm-scrobbler/core";
import { type ArtistImageLastfmClient } from "./artist-image-lastfm-client.js";

export async function resolveArtistImageUrl(
  artistName: string,
  lastfmClient: ArtistImageLastfmClient | undefined,
  fetchImpl: typeof fetch,
): Promise<string | undefined> {
  if (lastfmClient) {
    try {
      const url = await lastfmClient.getArtistImageUrl(artistName);
      if (url) {
        return url;
      }
    } catch {
      // Best-effort — see WireArtistImageOptions.lastfmClient's docstring for why a
      // failure here (most often: this artist isn't in Last.fm's catalog at all)
      // falls through to Deezer rather than surfacing as an error.
    }
  }
  return fetchArtistImageUrl(artistName, fetchImpl);
}

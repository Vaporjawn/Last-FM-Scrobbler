import { fetchArtistImageUrl } from "@lastfm-scrobbler/core";
import { type ArtistImageLastfmClient } from "./artist-image-lastfm-client.js";

/**
 * Finds a photo URL for an artist: asks Last.fm first when a client is given, and falls back to
 * Deezer's public artist search when Last.fm throws or returns nothing.
 *
 * @param lastfmClient - Omit to skip Last.fm entirely, e.g. in a build with no Last.fm API key.
 * @param fetchImpl - Used only for the Deezer fallback; a Last.fm client carries its own fetch.
 * @returns The image URL, or `undefined` when neither source has a photo for the artist.
 */
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

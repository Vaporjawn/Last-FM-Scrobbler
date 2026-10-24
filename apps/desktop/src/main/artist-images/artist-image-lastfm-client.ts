import { type LastfmClient } from "@lastfm-scrobbler/core";

/** The subset of `LastfmClient` this module needs — kept narrow for easy testing,
 * same convention as `ScrobblingClient` in `main/scrobbling/wire-scrobbling.ts`. */
export interface ArtistImageLastfmClient {
  getArtistImageUrl: LastfmClient["getArtistImageUrl"];
}

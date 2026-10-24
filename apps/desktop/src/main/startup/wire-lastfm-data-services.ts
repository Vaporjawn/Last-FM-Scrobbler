import { wireArtistImage } from "../artist-images/wire-artist-image.js";
import { wireFilterValidation } from "../filters/wire-filter-validation.js";
import { wireLastfmData } from "../lastfm/wire-lastfm-data.js";
import { wireTrackActions } from "../lastfm/wire-track-actions.js";
import type { LastfmServices } from "./lastfm-services.js";

/**
 * Wires the read-side Last.fm IPC (recent tracks, profile, friends), the artist-image lookup,
 * filter-expression validation and the signed track actions (love, unlove, tag).
 *
 * The artist-image lookup tries Last.fm's own photo first when a client is configured (usually
 * a miss, see `wire-artist-image.ts`) and Deezer's public search as the guaranteed fallback,
 * so unlike the Last.fm data it still works with no Last.fm credentials at all. Filter
 * validation is likewise unconditional: it is pure, local and needs no credentials.
 */
export function wireLastfmDataServices(
  expectedOrigin: string,
  lastfmServices: LastfmServices,
): void {
  const { lastfmClient, networkStatus, accountStore, createSessionClient } = lastfmServices;

  wireLastfmData({
    expectedOrigin,
    client: lastfmClient,
    ...(networkStatus ? { networkStatus } : {}),
  });
  wireArtistImage({
    expectedOrigin,
    ...(lastfmClient ? { lastfmClient } : {}),
  });
  wireFilterValidation({ expectedOrigin });
  wireTrackActions({
    expectedOrigin,
    accountStore,
    createSessionClient,
    ...(networkStatus ? { networkStatus } : {}),
  });
}

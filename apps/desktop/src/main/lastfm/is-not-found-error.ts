import { LastfmApiError } from "@lastfm-scrobbler/core";

/**
 * Last.fm's own error code for "no such artist/track/user in the catalog" — reused
 * from `LastfmClient.getArtistImageUrl`'s docstring and verified live in
 * `packages/core/tests/lastfm-api/client.test.ts`. This is a routine, expected
 * outcome (the overwhelming majority of local-file/streaming-service metadata is
 * either slightly mismatched or, for badly-tagged files, outright garbage — see the
 * real example below), not a real failure, so it gets the same "resolve gracefully
 * instead of rejecting" treatment `wire-artist-image.ts` already gives it for
 * `getArtistImageUrl`.
 */
const LASTFM_NOT_FOUND_CODE = 6;
/** True for a `LastfmApiError` whose code means "no such artist/track/user in the
 * catalog" (see `LASTFM_NOT_FOUND_CODE`) — false for anything else, including a
 * non-`LastfmApiError` failure (network down, malformed response, …), which should
 * still propagate to the renderer as a real error. */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof LastfmApiError && error.code === LASTFM_NOT_FOUND_CODE;
}

import electron from "electron";
import {
  LastfmApiError,
  reportNetworkOutcome,
  type ArtistInfo,
  type Friend,
  type LastfmClient,
  type NetworkStatusMonitor,
  type RecentTrack,
  type SimilarArtist,
  type TopAlbum,
  type TopAlbumsPeriod,
  type TopArtist,
  type TopArtistsPeriod,
  type TopTrack,
  type TopTracksPeriod,
  type TrackDetail,
  type UserProfile,
} from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";

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
function isNotFoundError(error: unknown): boolean {
  return error instanceof LastfmApiError && error.code === LASTFM_NOT_FOUND_CODE;
}

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

/** The subset of `LastfmClient` this module needs — kept narrow for easy testing. */
export interface LastfmDataClient {
  getRecentTracks: LastfmClient["getRecentTracks"];
  getTopArtists: LastfmClient["getTopArtists"];
  getTopTracks: LastfmClient["getTopTracks"];
  getTopAlbums: LastfmClient["getTopAlbums"];
  getFriends: LastfmClient["getFriends"];
  getUserInfo: LastfmClient["getUserInfo"];
  getLovedTracksCount: LastfmClient["getLovedTracksCount"];
  getArtistInfo: LastfmClient["getArtistInfo"];
  getSimilarArtists: LastfmClient["getSimilarArtists"];
  getTopTags: LastfmClient["getTopTags"];
  getTrackInfo: LastfmClient["getTrackInfo"];
}

export interface WireLastfmDataOptions {
  /** `undefined` when this build has no Last.fm API credentials configured. */
  readonly client: LastfmDataClient | undefined;
  /** Reports each call's outcome for the offline-mode status chip/tray tooltip — see
   * `reportNetworkOutcome`. Optional so existing/future tests that don't care about
   * network-status reporting need not supply one. */
  readonly networkStatus?: NetworkStatusMonitor;
}

const NOT_CONFIGURED_MESSAGE =
  "Last.fm API credentials are not configured for this build (LASTFM_API_KEY / " +
  "LASTFM_API_SECRET) — see docs/modules/desktop.md.";

/**
 * Wires the read-only Last.fm data IPC surface (see `shared/lastfm-api.ts`) to a
 * `LastfmClient`. These are all public, unsigned endpoints — no session key or active
 * account is needed, just a username (typically the active account's, chosen by the
 * renderer) or, for the artist endpoints, just an artist name. Signed, account-specific
 * actions (love/unlove/addTags) live in `wire-track-actions.ts` instead.
 *
 * Every `client` call is wrapped in `reportNetworkOutcome` (see that function's
 * docstring) — a classified connectivity failure reports to `networkStatus` and
 * surfaces to the renderer as a friendly message instead of a raw technical one; an
 * application-level failure (including the `isNotFoundError` case below) passes
 * through completely unaffected.
 */
export function wireLastfmData(options: WireLastfmDataOptions): () => void {
  const { client, networkStatus } = options;

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetRecentTracks,
    (
      _event,
      user: unknown,
      limit?: unknown,
      page?: unknown,
    ): Promise<readonly RecentTrack[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return reportNetworkOutcome(
        networkStatus,
        client.getRecentTracks({
          user: String(user),
          ...(limit !== undefined ? { limit: Number(limit) } : {}),
          ...(page !== undefined ? { page: Number(page) } : {}),
        }),
      );
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetTopArtists,
    (
      _event,
      user: unknown,
      limit?: unknown,
      period?: unknown,
    ): Promise<readonly TopArtist[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return reportNetworkOutcome(
        networkStatus,
        client.getTopArtists({
          user: String(user),
          ...(limit !== undefined ? { limit: Number(limit) } : {}),
          ...(period !== undefined ? { period: period as TopArtistsPeriod } : {}),
        }),
      );
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetTopTracks,
    (
      _event,
      user: unknown,
      limit?: unknown,
      period?: unknown,
    ): Promise<readonly TopTrack[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return reportNetworkOutcome(
        networkStatus,
        client.getTopTracks({
          user: String(user),
          ...(limit !== undefined ? { limit: Number(limit) } : {}),
          ...(period !== undefined ? { period: period as TopTracksPeriod } : {}),
        }),
      );
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetTopAlbums,
    (
      _event,
      user: unknown,
      limit?: unknown,
      period?: unknown,
    ): Promise<readonly TopAlbum[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return reportNetworkOutcome(
        networkStatus,
        client.getTopAlbums({
          user: String(user),
          ...(limit !== undefined ? { limit: Number(limit) } : {}),
          ...(period !== undefined ? { period: period as TopAlbumsPeriod } : {}),
        }),
      );
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetFriends,
    (_event, user: unknown): Promise<readonly Friend[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return reportNetworkOutcome(networkStatus, client.getFriends({ user: String(user) }));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetUserInfo,
    (_event, user: unknown): Promise<UserProfile> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return reportNetworkOutcome(networkStatus, client.getUserInfo({ user: String(user) }));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetLovedTracksCount,
    (_event, user: unknown): Promise<number> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return reportNetworkOutcome(networkStatus, client.getLovedTracksCount({ user: String(user) }));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetArtistInfo,
    (_event, artist: unknown, username: unknown): Promise<ArtistInfo | undefined> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      // `typeof username === "string"`, not `!== undefined`: narrowing `unknown` via
      // an undefined check alone still leaves the non-undefined branch typed as `{}`
      // (any non-nullish value), which @typescript-eslint/no-base-to-string correctly
      // flags — a real caller could still pass something whose `toString()` isn't
      // meaningful. Requiring an actual `string` sidesteps that for real, not just for
      // lint: an IPC argument that isn't already a string shouldn't be silently
      // coerced (e.g. to "[object Object]") into one.
      //
      // "Not found" (see `isNotFoundError`) resolves to `undefined` — the same shape
      // `ArtistInfoState.info` already has for "nothing loaded yet" — rather than
      // rejecting across the IPC boundary. Without this, a track whose artist tag is
      // missing/garbage (a real, common case: locally-tagged files, an OS media
      // session reporting a file path instead of an artist) surfaced Electron's raw
      // "Error invoking remote method ...: LastfmApiError: The artist you supplied
      // could not be found" as a red error banner in `ArtistInfoPanel` — a routine,
      // expected outcome dressed up as a crash. `ArtistInfoPanel` already renders
      // `undefined` as its normal "No additional artist info available." empty state,
      // so no renderer-side change is needed once this resolves instead of rejects.
      //
      // `reportNetworkOutcome` runs on the *inner* call, before this `.catch` below —
      // a classified network failure never reaches `isNotFoundError` at all (it's
      // already been rewritten and reported by then); a real not-found
      // `LastfmApiError` passes through `reportNetworkOutcome` completely unchanged
      // and is still caught here exactly as before.
      return reportNetworkOutcome(
        networkStatus,
        client.getArtistInfo({
          artist: String(artist),
          ...(typeof username === "string" ? { username } : {}),
        }),
      ).catch((error: unknown) => {
        if (isNotFoundError(error)) {
          return undefined;
        }
        throw error;
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetSimilarArtists,
    (_event, artist: unknown, limit?: unknown): Promise<readonly SimilarArtist[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      // Same "not found" → graceful-empty-result treatment as getArtistInfo just
      // above, and for the same reason: `useArtistInfo` fetches both together via
      // `Promise.all`, so an unhandled rejection here would still surface the raw
      // error even after getArtistInfo's own fix. An empty array is
      // `ArtistInfoPanel`'s existing "no similar artists" shape (it only renders the
      // "Similar Artists" section when `similarArtists.length > 0`).
      return reportNetworkOutcome(
        networkStatus,
        client.getSimilarArtists({
          artist: String(artist),
          ...(limit !== undefined ? { limit: Number(limit) } : {}),
        }),
      ).catch((error: unknown) => {
        if (isNotFoundError(error)) {
          return [];
        }
        throw error;
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetTopTags,
    (_event, artist: unknown): Promise<readonly string[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return reportNetworkOutcome(networkStatus, client.getTopTags({ artist: String(artist) }));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetTrackInfo,
    (_event, artist: unknown, track: unknown, username?: unknown): Promise<TrackDetail> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      // Same reasoning as getArtistInfo's handler above.
      return reportNetworkOutcome(
        networkStatus,
        client.getTrackInfo({
          artist: String(artist),
          track: String(track),
          ...(typeof username === "string" ? { username } : {}),
        }),
      );
    },
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetRecentTracks);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetTopArtists);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetTopTracks);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetTopAlbums);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetFriends);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetUserInfo);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetLovedTracksCount);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetArtistInfo);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetSimilarArtists);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetTopTags);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetTrackInfo);
  };
}

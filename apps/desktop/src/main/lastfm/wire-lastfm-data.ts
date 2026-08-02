import electron from "electron";
import type {
  ArtistInfo,
  Friend,
  LastfmClient,
  RecentTrack,
  SimilarArtist,
  TopArtist,
  TrackDetail,
  UserProfile,
} from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

/** The subset of `LastfmClient` this module needs — kept narrow for easy testing. */
export interface LastfmDataClient {
  getRecentTracks: LastfmClient["getRecentTracks"];
  getTopArtists: LastfmClient["getTopArtists"];
  getFriends: LastfmClient["getFriends"];
  getUserInfo: LastfmClient["getUserInfo"];
  getArtistInfo: LastfmClient["getArtistInfo"];
  getSimilarArtists: LastfmClient["getSimilarArtists"];
  getTopTags: LastfmClient["getTopTags"];
  getTrackInfo: LastfmClient["getTrackInfo"];
}

export interface WireLastfmDataOptions {
  /** `undefined` when this build has no Last.fm API credentials configured. */
  readonly client: LastfmDataClient | undefined;
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
 */
export function wireLastfmData(options: WireLastfmDataOptions): () => void {
  const { client } = options;

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetRecentTracks,
    (_event, user: unknown, limit?: unknown): Promise<readonly RecentTrack[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return client.getRecentTracks({
        user: String(user),
        ...(limit !== undefined ? { limit: Number(limit) } : {}),
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetTopArtists,
    (_event, user: unknown, limit?: unknown): Promise<readonly TopArtist[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return client.getTopArtists({
        user: String(user),
        ...(limit !== undefined ? { limit: Number(limit) } : {}),
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetFriends,
    (_event, user: unknown): Promise<readonly Friend[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return client.getFriends({ user: String(user) });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetUserInfo,
    (_event, user: unknown): Promise<UserProfile> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return client.getUserInfo({ user: String(user) });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetArtistInfo,
    (_event, artist: unknown, username: unknown): Promise<ArtistInfo> => {
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
      return client.getArtistInfo({
        artist: String(artist),
        ...(typeof username === "string" ? { username } : {}),
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetSimilarArtists,
    (_event, artist: unknown, limit?: unknown): Promise<readonly SimilarArtist[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return client.getSimilarArtists({
        artist: String(artist),
        ...(limit !== undefined ? { limit: Number(limit) } : {}),
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetTopTags,
    (_event, artist: unknown): Promise<readonly string[]> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      return client.getTopTags({ artist: String(artist) });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.lastfmGetTrackInfo,
    (_event, artist: unknown, track: unknown, username?: unknown): Promise<TrackDetail> => {
      if (!client) {
        return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
      }
      // Same reasoning as getArtistInfo's handler above.
      return client.getTrackInfo({
        artist: String(artist),
        track: String(track),
        ...(typeof username === "string" ? { username } : {}),
      });
    },
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetRecentTracks);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetTopArtists);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetFriends);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetUserInfo);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetArtistInfo);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetSimilarArtists);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetTopTags);
    ipcMain.removeHandler(IPC_CHANNELS.lastfmGetTrackInfo);
  };
}

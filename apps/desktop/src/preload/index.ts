import electron from "electron";
import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";
import type {
  ArtistInfo,
  Friend,
  RecentTrack,
  SimilarArtist,
  TopAlbum,
  TopArtist,
  TopTrack,
  TrackDetail,
  UserProfile,
} from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../shared/ipc-channels.js";
import type { AppInfoApi } from "../shared/app-info-api.js";
import type { ArtistImageApi } from "../shared/artist-image-api.js";
import type { AuthApi } from "../shared/auth-api.js";
import type { BugReportApi } from "../shared/bug-report-api.js";
import type { FilterApi, FilterValidationResult } from "../shared/filter-api.js";
import type { LastfmDataApi } from "../shared/lastfm-api.js";
import type { NowPlayingApi } from "../shared/now-playing-api.js";
import type { NowPlayingSnapshot } from "../shared/now-playing-snapshot.js";
import type { AppSettings, SettingsApi } from "../shared/settings-api.js";
import type { UpdateStatus } from "../shared/update-status.js";
import type { UpdatesApi } from "../shared/updates-api.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { contextBridge, ipcRenderer } from "electron"`.
const { contextBridge, ipcRenderer } = electron;

const nowPlayingApi: NowPlayingApi = {
  getCurrent() {
    return ipcRenderer.invoke(IPC_CHANNELS.nowPlayingGetCurrent) as Promise<NowPlayingSnapshot>;
  },
  onTrackChanged(callback) {
    const listener = (_event: Electron.IpcRendererEvent, track: TrackInfo): void => {
      callback(track);
    };
    ipcRenderer.on(IPC_CHANNELS.nowPlayingTrackChanged, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.nowPlayingTrackChanged, listener);
    };
  },
  onPlaybackStateChanged(callback) {
    const listener = (_event: Electron.IpcRendererEvent, state: PlaybackState): void => {
      callback(state);
    };
    ipcRenderer.on(IPC_CHANNELS.nowPlayingStateChanged, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.nowPlayingStateChanged, listener);
    };
  },
};

const authApi: AuthApi = {
  isConfigured() {
    return ipcRenderer.invoke(IPC_CHANNELS.authIsConfigured) as Promise<boolean>;
  },
  credentialsSource() {
    return ipcRenderer.invoke(IPC_CHANNELS.authCredentialsSource) as Promise<
      "environment" | "user-supplied" | "none"
    >;
  },
  login() {
    return ipcRenderer.invoke(IPC_CHANNELS.authLogin) as Promise<{ username: string }>;
  },
  logout(username) {
    return ipcRenderer.invoke(IPC_CHANNELS.authLogout, username) as Promise<void>;
  },
  listAccounts() {
    return ipcRenderer.invoke(IPC_CHANNELS.authListAccounts) as Promise<readonly string[]>;
  },
  getActiveAccount() {
    return ipcRenderer.invoke(IPC_CHANNELS.authGetActiveAccount) as Promise<string | undefined>;
  },
  setActiveAccount(username) {
    return ipcRenderer.invoke(IPC_CHANNELS.authSetActiveAccount, username) as Promise<void>;
  },
  setAppCredentials(apiKey, apiSecret) {
    return ipcRenderer.invoke(
      IPC_CHANNELS.authSetAppCredentials,
      apiKey,
      apiSecret,
    ) as Promise<void>;
  },
  clearAppCredentials() {
    return ipcRenderer.invoke(IPC_CHANNELS.authClearAppCredentials) as Promise<void>;
  },
  relaunch() {
    return ipcRenderer.invoke(IPC_CHANNELS.appRelaunch) as Promise<void>;
  },
};

const lastfmApi: LastfmDataApi = {
  getRecentTracks(user, limit, page) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmGetRecentTracks, user, limit, page) as Promise<
      readonly RecentTrack[]
    >;
  },
  getTopArtists(user, limit, period) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmGetTopArtists, user, limit, period) as Promise<
      readonly TopArtist[]
    >;
  },
  getTopTracks(user, limit, period) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmGetTopTracks, user, limit, period) as Promise<
      readonly TopTrack[]
    >;
  },
  getTopAlbums(user, limit, period) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmGetTopAlbums, user, limit, period) as Promise<
      readonly TopAlbum[]
    >;
  },
  getFriends(user) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmGetFriends, user) as Promise<readonly Friend[]>;
  },
  getUserInfo(user) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmGetUserInfo, user) as Promise<UserProfile>;
  },
  getArtistInfo(artist, username) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmGetArtistInfo, artist, username) as Promise<ArtistInfo>;
  },
  getSimilarArtists(artist, limit) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmGetSimilarArtists, artist, limit) as Promise<
      readonly SimilarArtist[]
    >;
  },
  getTopTags(artist) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmGetTopTags, artist) as Promise<readonly string[]>;
  },
  getTrackInfo(artist, track, username) {
    return ipcRenderer.invoke(
      IPC_CHANNELS.lastfmGetTrackInfo,
      artist,
      track,
      username,
    ) as Promise<TrackDetail>;
  },
  loveTrack(artist, track) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmLoveTrack, artist, track) as Promise<void>;
  },
  unloveTrack(artist, track) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmUnloveTrack, artist, track) as Promise<void>;
  },
  addTags(artist, track, tags) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmAddTags, artist, track, tags) as Promise<void>;
  },
};

const artistImageApi: ArtistImageApi = {
  getUrl(artistName) {
    return ipcRenderer.invoke(IPC_CHANNELS.artistImageGetUrl, artistName) as Promise<
      string | undefined
    >;
  },
};

const filterApi: FilterApi = {
  validate(expression) {
    return ipcRenderer.invoke(IPC_CHANNELS.filterValidate, expression) as Promise<
      FilterValidationResult
    >;
  },
};

const bugReportApi: BugReportApi = {
  isConfigured() {
    return ipcRenderer.invoke(IPC_CHANNELS.bugReportIsConfigured) as Promise<boolean>;
  },
  submit(title, body) {
    return ipcRenderer.invoke(IPC_CHANNELS.bugReportSubmit, title, body) as Promise<{
      issueUrl: string;
    }>;
  },
};

const settingsApi: SettingsApi = {
  get() {
    return ipcRenderer.invoke(IPC_CHANNELS.settingsGet) as Promise<AppSettings>;
  },
  set(patch) {
    return ipcRenderer.invoke(IPC_CHANNELS.settingsSet, patch) as Promise<AppSettings>;
  },
  reset() {
    return ipcRenderer.invoke(IPC_CHANNELS.settingsReset) as Promise<AppSettings>;
  },
};

const updatesApi: UpdatesApi = {
  getStatus() {
    return ipcRenderer.invoke(IPC_CHANNELS.updatesGetStatus) as Promise<UpdateStatus>;
  },
  checkNow() {
    return ipcRenderer.invoke(IPC_CHANNELS.updatesCheckNow) as Promise<void>;
  },
  onStatusChanged(callback) {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void => {
      callback(status);
    };
    ipcRenderer.on(IPC_CHANNELS.updatesStatusChanged, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.updatesStatusChanged, listener);
    };
  },
};

const appInfoApi: AppInfoApi = {
  getVersion() {
    return ipcRenderer.invoke(IPC_CHANNELS.appGetVersion) as Promise<string>;
  },
  showMainWindow() {
    return ipcRenderer.invoke(IPC_CHANNELS.appShowMainWindow) as Promise<void>;
  },
};

contextBridge.exposeInMainWorld("nowPlaying", nowPlayingApi);
contextBridge.exposeInMainWorld("auth", authApi);
contextBridge.exposeInMainWorld("lastfm", lastfmApi);
contextBridge.exposeInMainWorld("artistImage", artistImageApi);
contextBridge.exposeInMainWorld("filter", filterApi);
contextBridge.exposeInMainWorld("bugReport", bugReportApi);
contextBridge.exposeInMainWorld("settings", settingsApi);
contextBridge.exposeInMainWorld("updates", updatesApi);
contextBridge.exposeInMainWorld("appInfo", appInfoApi);
// A plain value (not an async API) so the renderer can pick OS-appropriate copy (e.g.
// "Close to tray" vs. "Close to menu bar") without a round trip — see SettingsPage.
contextBridge.exposeInMainWorld("platform", process.platform);

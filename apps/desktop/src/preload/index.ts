import electron from "electron";
import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";
import type { Friend, RecentTrack, TopArtist } from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../shared/ipc-channels.js";
import type { AuthApi } from "../shared/auth-api.js";
import type { BugReportApi } from "../shared/bug-report-api.js";
import type { LastfmDataApi } from "../shared/lastfm-api.js";
import type { NowPlayingApi } from "../shared/now-playing-api.js";
import type { NowPlayingSnapshot } from "../shared/now-playing-snapshot.js";

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
};

const lastfmApi: LastfmDataApi = {
  getRecentTracks(user, limit) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmGetRecentTracks, user, limit) as Promise<
      readonly RecentTrack[]
    >;
  },
  getTopArtists(user, limit) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmGetTopArtists, user, limit) as Promise<
      readonly TopArtist[]
    >;
  },
  getFriends(user) {
    return ipcRenderer.invoke(IPC_CHANNELS.lastfmGetFriends, user) as Promise<readonly Friend[]>;
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

contextBridge.exposeInMainWorld("nowPlaying", nowPlayingApi);
contextBridge.exposeInMainWorld("auth", authApi);
contextBridge.exposeInMainWorld("lastfm", lastfmApi);
contextBridge.exposeInMainWorld("bugReport", bugReportApi);

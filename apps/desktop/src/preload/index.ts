import { contextBridge, ipcRenderer } from "electron";
import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";
import { IPC_CHANNELS } from "../shared/ipc-channels.js";
import type { NowPlayingApi } from "../shared/now-playing-api.js";
import type { NowPlayingSnapshot } from "../shared/now-playing-snapshot.js";

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

contextBridge.exposeInMainWorld("nowPlaying", nowPlayingApi);

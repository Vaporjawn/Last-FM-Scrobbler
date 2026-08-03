import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";
import type { NowPlayingSnapshot } from "./now-playing-snapshot.js";

/**
 * The renderer-facing API the preload script exposes via
 * `contextBridge.exposeInMainWorld("nowPlaying", ...)`. Shared between preload (which
 * implements it) and the renderer (which declares `window.nowPlaying` against it — see
 * `src/renderer/src/now-playing-window.d.ts`) so the two sides can't drift apart.
 */
export interface NowPlayingApi {
  /** Pulls the current snapshot once — call this on mount, since push events
   * (`onTrackChanged`/`onPlaybackStateChanged`) only reach listeners registered
   * *after* they fire. */
  getCurrent(): Promise<NowPlayingSnapshot>;
  onTrackChanged(callback: (track: TrackInfo) => void): () => void;
  onPlaybackStateChanged(callback: (state: PlaybackState) => void): () => void;
  /** Elapsed playback position in seconds — pushed roughly every second while
   * something is actively playing, not while paused/stopped (see
   * `IPC_CHANNELS.nowPlayingPositionChanged`'s docstring). */
  onPositionChanged(callback: (positionSec: number) => void): () => void;
}

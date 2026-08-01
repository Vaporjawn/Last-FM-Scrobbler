import type { PlaybackState } from "./playback-state.js";
import type { TrackInfo } from "./track-info.js";

/** Unsubscribe function returned by every `PlaybackSource` subscription. */
export type Unsubscribe = () => void;

/**
 * Common interface every OS-specific adapter (MPRIS/SMTC/MediaRemote) implements.
 * `packages/core` depends only on this interface, never on a concrete adapter.
 */
export interface PlaybackSource {
  onTrackChanged(callback: (track: TrackInfo) => void): Unsubscribe;
  onPlaybackStateChanged(callback: (state: PlaybackState) => void): Unsubscribe;
  getPosition(): Promise<number>;
}

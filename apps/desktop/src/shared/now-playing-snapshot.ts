import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";

/** Current now-playing state, as pulled via `IPC_CHANNELS.nowPlayingGetCurrent`. */
export interface NowPlayingSnapshot {
  readonly track: TrackInfo | undefined;
  readonly state: PlaybackState;
}

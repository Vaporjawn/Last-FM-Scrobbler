import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";

/** Current now-playing state, as pulled via `IPC_CHANNELS.nowPlayingGetCurrent`. */
export interface NowPlayingSnapshot {
  readonly track: TrackInfo | undefined;
  readonly state: PlaybackState;
  /** Elapsed playback position in seconds at the moment this snapshot was pulled —
   * same "pull current + subscribe to push" reasoning as `track`/`state` above (see
   * `useNowPlaying`'s docstring): a renderer mounting mid-playback shows the right
   * progress immediately instead of starting at 0 and jumping once the first
   * `IPC_CHANNELS.nowPlayingPositionChanged` push arrives (up to ~1s later). `0` when
   * nothing is playing or the source has nothing to report — same never-fails
   * contract every `PlaybackSource.getPosition()` implementation already follows. */
  readonly positionSec: number;
}

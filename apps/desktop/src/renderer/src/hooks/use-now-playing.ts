import { useEffect, useState } from "react";
import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";

export interface NowPlayingState {
  readonly track: TrackInfo | undefined;
  readonly state: PlaybackState;
  /** Elapsed playback position in seconds — see `NowPlayingApi.onPositionChanged`'s
   * docstring for when this updates. Reset to `0` immediately on every track change
   * (see the `onTrackChanged` subscription below), rather than waiting on the next
   * position push, since the previous track's elapsed time is meaningless for a new
   * one. */
  readonly positionSec: number;
}

const STOPPED: NowPlayingState = { track: undefined, state: "stopped", positionSec: 0 };

/**
 * Subscribes to `window.nowPlaying` (exposed by the preload script — see
 * `src/shared/now-playing-api.ts`). Pulls the current snapshot on mount in addition to
 * subscribing to push updates, since a listener registered after the main process's
 * first event would otherwise see nothing until the *next* change.
 *
 * Returns the "stopped, nothing playing" state — rather than throwing — when
 * `window.nowPlaying` isn't present, which is expected outside a real Electron
 * renderer (e.g. component tests).
 */
export function useNowPlaying(): NowPlayingState {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingState>(STOPPED);

  useEffect(() => {
    if (!window.nowPlaying) {
      return;
    }
    let cancelled = false;

    window.nowPlaying
      .getCurrent()
      .then((snapshot) => {
        if (!cancelled) {
          setNowPlaying(snapshot);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to fetch the current now-playing snapshot:", error);
      });

    const unsubscribeTrack = window.nowPlaying.onTrackChanged((track) => {
      // positionSec resets to 0 here rather than waiting for the next
      // onPositionChanged push (up to ~1s away) — the previous track's elapsed time
      // is meaningless for a new one and would otherwise flash as a too-large,
      // stale progress bar for a moment.
      setNowPlaying((previous) => ({ ...previous, track, positionSec: 0 }));
    });
    const unsubscribeState = window.nowPlaying.onPlaybackStateChanged((state) => {
      setNowPlaying((previous) => ({ ...previous, state }));
    });
    const unsubscribePosition = window.nowPlaying.onPositionChanged((positionSec) => {
      setNowPlaying((previous) => ({ ...previous, positionSec }));
    });

    return () => {
      cancelled = true;
      unsubscribeTrack();
      unsubscribeState();
      unsubscribePosition();
    };
  }, []);

  return nowPlaying;
}

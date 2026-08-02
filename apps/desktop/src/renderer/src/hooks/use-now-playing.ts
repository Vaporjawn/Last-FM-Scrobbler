import { useEffect, useState } from "react";
import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";

export interface NowPlayingState {
  readonly track: TrackInfo | undefined;
  readonly state: PlaybackState;
}

const STOPPED: NowPlayingState = { track: undefined, state: "stopped" };

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
      setNowPlaying((previous) => ({ ...previous, track }));
    });
    const unsubscribeState = window.nowPlaying.onPlaybackStateChanged((state) => {
      setNowPlaying((previous) => ({ ...previous, state }));
    });

    return () => {
      cancelled = true;
      unsubscribeTrack();
      unsubscribeState();
    };
  }, []);

  return nowPlaying;
}

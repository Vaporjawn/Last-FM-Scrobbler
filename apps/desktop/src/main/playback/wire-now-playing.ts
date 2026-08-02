import type { BrowserWindow } from "electron";
import { ipcMain } from "electron";
import type { PlaybackSource, PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";
import { Tracker } from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";
import type { NowPlayingSnapshot } from "../../shared/now-playing-snapshot.js";

const TRACKER_TICK_INTERVAL_MS = 1000;

/**
 * Relays a `PlaybackSource`'s raw track/state events to the renderer over IPC (so the
 * Now Playing view shows exactly what's playing, unfiltered), and separately drives a
 * `Tracker` from the same source for scrobble-eligibility bookkeeping. These are kept
 * distinct on purpose: "what's playing" and "what's eligible to scrobble" are
 * different questions — an exclusion-filtered track should still show as now playing,
 * it just won't reach `onScrobbleEligible`.
 *
 * Also answers `IPC_CHANNELS.nowPlayingGetCurrent` with the latest known snapshot —
 * push events only reach listeners registered *after* they fire, so a renderer
 * mounting after the source's initial snapshot needs a way to pull current state
 * rather than wait indefinitely for the next change.
 *
 * Returns a cleanup function that stops the tracker, its tick timer, and the
 * `get-current` handler.
 */
export function wireNowPlaying(source: PlaybackSource, mainWindow: BrowserWindow): () => void {
  let currentTrack: TrackInfo | undefined;
  let currentState: PlaybackState = "stopped";

  source.onTrackChanged((track) => {
    currentTrack = track;
    mainWindow.webContents.send(IPC_CHANNELS.nowPlayingTrackChanged, track);
  });
  source.onPlaybackStateChanged((state) => {
    currentState = state;
    mainWindow.webContents.send(IPC_CHANNELS.nowPlayingStateChanged, state);
  });

  ipcMain.handle(IPC_CHANNELS.nowPlayingGetCurrent, (): NowPlayingSnapshot => {
    return { track: currentTrack, state: currentState };
  });

  const tracker = new Tracker({
    source,
    events: {
      onScrobbleEligible: (event) => {
        // TODO: hand off to ScrobbleQueue + LastfmClient once account/auth UI lands
        // (packages/core already has both — see docs/modules/core.md). Logged for now
        // so eligibility is at least observable during development.
        console.log(`Scrobble eligible: ${event.track.artist} — ${event.track.title}`);
      },
    },
  });
  tracker.start();
  const tickHandle = setInterval(() => {
    tracker.tick();
  }, TRACKER_TICK_INTERVAL_MS);

  return () => {
    clearInterval(tickHandle);
    tracker.stop();
    ipcMain.removeHandler(IPC_CHANNELS.nowPlayingGetCurrent);
  };
}

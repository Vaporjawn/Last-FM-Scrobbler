import type { BrowserWindow } from "electron";
import electron from "electron";
import type { PlaybackSource, PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";
import {
  Tracker,
  type CompiledFilter,
  type ScrobbleEligibleEvent,
  type TrackChangedEvent,
} from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";
import type { NowPlayingSnapshot } from "../../shared/now-playing-snapshot.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

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
 * `onScrobbleEligible` hands off eligible plays for actual submission — see
 * `main/scrobbling/wire-scrobbling.ts`. Defaults to logging (not silently dropping)
 * when omitted, so eligibility is still observable if a caller doesn't wire real
 * submission (e.g. a future test harness, or a build with no API credentials
 * configured — see `main/lastfm/create-lastfm-client.ts`).
 *
 * `onTrackChanged` hands off every new distinct track (already de-duplicated and
 * exclusion-filtered by the `Tracker`) for a real-time Last.fm "now playing" update —
 * see `main/scrobbling/wire-scrobbling.ts`'s `onTrackChanged`. Optional and separate
 * from `onScrobbleEligible` because they answer different questions on different
 * timelines: "what's playing right now" (fires immediately on every track change) vs.
 * "what's eligible to scrobble" (fires once, after the eligibility threshold —
 * usually well after the track started). Omitted entirely (not defaulted to a no-op
 * logger like `onScrobbleEligible`) in builds/tests that don't need it.
 *
 * `filter` (see `AppSettings.filterExpression`'s docstring) excludes a matching track
 * from the `Tracker` entirely — no `onScrobbleEligible`, no `onTrackChanged` — but
 * never affects the raw relay above, so an excluded track still shows in the
 * renderer's "Now Playing" view exactly as it's actually playing; only scrobbling
 * itself is suppressed for it.
 *
 * Returns a cleanup function that stops the tracker, its tick timer, the `get-current`
 * handler, and — critically, since `source` is normally a shared, module-level
 * singleton (see `main/index.ts`) that outlives any one window — this function's own
 * subscriptions to it, so a destroyed window's `webContents` is never written to again.
 */
export function wireNowPlaying(
  source: PlaybackSource,
  mainWindow: BrowserWindow,
  onScrobbleEligible: (event: ScrobbleEligibleEvent) => void = (event) => {
    console.log(`Scrobble eligible (not submitted — no handler wired): ${event.track.artist} — ${event.track.title}`);
  },
  onTrackChanged?: (event: TrackChangedEvent) => void,
  filter?: CompiledFilter,
): () => void {
  let currentTrack: TrackInfo | undefined;
  let currentState: PlaybackState = "stopped";

  // Captured so the cleanup returned below can actually unsubscribe from the shared
  // `playbackSource` singleton (see main/index.ts) — without this, recreating the main
  // window (close-to-tray disabled, then reopened via the Dock icon) left the old,
  // destroyed window's `webContents.send` callback still subscribed, which throws the
  // next time a track/state change fires it against a now-destroyed BrowserWindow.
  const unsubscribeTrack = source.onTrackChanged((track) => {
    currentTrack = track;
    mainWindow.webContents.send(IPC_CHANNELS.nowPlayingTrackChanged, track);
  });
  const unsubscribeState = source.onPlaybackStateChanged((state) => {
    currentState = state;
    mainWindow.webContents.send(IPC_CHANNELS.nowPlayingStateChanged, state);
  });

  ipcMain.handle(IPC_CHANNELS.nowPlayingGetCurrent, async (): Promise<NowPlayingSnapshot> => {
    const positionSec = await source.getPosition();
    return { track: currentTrack, state: currentState, positionSec };
  });

  const tracker = new Tracker({
    source,
    events: { onScrobbleEligible, ...(onTrackChanged ? { onTrackChanged } : {}) },
    ...(filter ? { filter } : {}),
  });
  tracker.start();
  const tickHandle = setInterval(() => {
    tracker.tick();

    // Only worth polling while something is actually advancing — paused/stopped
    // playback has no reason to change every tick, and every current adapter's
    // `getPosition()` is either a live IPC/D-Bus round trip (Windows/Linux) or a
    // spawned-process read (macOS), not free to call for no reason.
    if (currentState === "playing") {
      source
        .getPosition()
        .then((positionSec) => {
          mainWindow.webContents.send(IPC_CHANNELS.nowPlayingPositionChanged, positionSec);
        })
        .catch((error: unknown) => {
          // Defensive only — every current adapter's getPosition() already never
          // rejects (see e.g. adapter-macos's MacosPlaybackSource.getPosition,
          // adapter-linux's queryMprisPosition), but the PlaybackSource interface
          // itself doesn't guarantee that. Playback position is decorative, not
          // scrobble-critical (see Tracker, which never reads it) — never worth
          // crashing the tick loop over.
          console.error("Failed to read playback position:", error);
        });
    }
  }, TRACKER_TICK_INTERVAL_MS);

  return () => {
    clearInterval(tickHandle);
    tracker.stop();
    unsubscribeTrack();
    unsubscribeState();
    ipcMain.removeHandler(IPC_CHANNELS.nowPlayingGetCurrent);
  };
}

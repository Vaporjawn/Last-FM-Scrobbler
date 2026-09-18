import type { ScrobbleEligibleEvent, TrackChangedEvent } from "@lastfm-scrobbler/core";

export interface GateScrobblingEnabledOptions {
  /** The real `Tracker` callback that would otherwise reach
   * `main/scrobbling/wire-scrobbling.ts`'s `ScrobblingHandle.onScrobbleEligible` (a
   * `queue.enqueue` call) — see `main/index.ts`'s `wireScrobbling(...)` call. */
  readonly onScrobbleEligible: (event: ScrobbleEligibleEvent) => void;
  /** The real `Tracker` callback that would otherwise reach
   * `main/scrobbling/wire-scrobbling.ts`'s `ScrobblingHandle.onTrackChanged` (a
   * `client.updateNowPlaying` push to every connected service). */
  readonly onTrackChanged: (event: TrackChangedEvent) => void;
  /** Called fresh on every event, not captured once at wiring time — see this
   * module's own docstring for why. `main/index.ts` passes
   * `() => settingsStore.get().scrobblingEnabled`. */
  readonly isScrobblingEnabled: () => boolean;
}

export interface GatedScrobblingCallbacks {
  readonly onScrobbleEligible: (event: ScrobbleEligibleEvent) => void;
  readonly onTrackChanged: (event: TrackChangedEvent) => void;
}

/**
 * Wraps `Tracker`'s `onScrobbleEligible`/`onTrackChanged` callbacks (see
 * `main/playback/wire-now-playing.ts`, which passes both straight to a `Tracker`) so
 * neither one reaches its real destination in `main/scrobbling/wire-scrobbling.ts`
 * (`onScrobbleEligible`'s `queue.enqueue`, `onTrackChanged`'s `client.updateNowPlaying`)
 * whenever `AppSettings.scrobblingEnabled` is off.
 *
 * `isScrobblingEnabled` is called fresh on every event (not captured once at wiring
 * time) — the same "read the live settings value at the moment it matters" convention
 * this app already uses for `AppSettings.notifyOnScrobble`/`notifyOnScrobbleFailure`
 * (see `main/index.ts`'s `wireScrobbling({ onScrobbled, onScrobbleFailed })` closures,
 * which call `settingsStore.get()` at the point each notification actually fires
 * rather than at startup). This is what lets toggling Settings → General's "Enable
 * scrobbling" switch take effect on the very next track — no restart needed, unlike
 * `filterExpression`/`skipNonMusicVideos` (compiled once into a `CompiledFilter` at
 * startup, since `Tracker` has no way to swap its filter after construction — see
 * `AppSettings.filterExpression`'s docstring). `scrobblingEnabled` is deliberately
 * *not* folded into that same `CompiledFilter` for exactly that reason: this gate is
 * the mechanism that keeps it live instead.
 *
 * Deliberately doesn't touch `wireNowPlaying`'s raw track/state relay to the
 * renderer — that's a separate code path entirely (see that module's own docstring for
 * why "what's playing" and "what's eligible to scrobble" are different questions), so
 * the Now Playing view keeps showing whatever's actually playing throughout; only
 * submission is suppressed while scrobbling is paused.
 */
export function gateScrobblingEnabled(options: GateScrobblingEnabledOptions): GatedScrobblingCallbacks {
  const { onScrobbleEligible, onTrackChanged, isScrobblingEnabled } = options;
  return {
    onScrobbleEligible: (event) => {
      if (isScrobblingEnabled()) {
        onScrobbleEligible(event);
      }
    },
    onTrackChanged: (event) => {
      if (isScrobblingEnabled()) {
        onTrackChanged(event);
      }
    },
  };
}

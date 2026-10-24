import type { PlaybackState, TrackInfo, Unsubscribe } from "@lastfm-scrobbler/shared-types";
import { type NowPlayingPayload } from "./now-playing-payload.js";
import { toTrackInfo } from "./to-track-info.js";
import { trackIdentity } from "./track-identity.js";

/**
 * One JSON line emitted by `mediaremote-adapter.pl stream`. Only events of type `"data"`
 * are acted on; when `diff` is true the payload holds just the fields that changed since
 * the previous event, otherwise it is a full snapshot.
 */
interface StreamEvent {
  readonly type: string;
  readonly diff?: boolean;
  readonly payload?: NowPlayingPayload | null;
}
/**
 * Parses `mediaremote-adapter`'s newline-delimited JSON stream into `PlaybackSource`
 * events. Kept separate from process-spawning so the parsing logic is testable without
 * an actual macOS/perl/framework in the loop.
 */
export class NowPlayingStreamParser {
  private currentPayload: NowPlayingPayload = {};
  private currentIdentity: string | undefined;
  private hasTrack = false;
  private state: PlaybackState = "stopped";

  private readonly trackListeners = new Set<(track: TrackInfo) => void>();
  private readonly stateListeners = new Set<(state: PlaybackState) => void>();

  /** Registers a listener called whenever the stream reports a track with a new identity. */
  onTrackChanged(callback: (track: TrackInfo) => void): Unsubscribe {
    this.trackListeners.add(callback);
    return () => this.trackListeners.delete(callback);
  }

  /** Registers a listener called whenever the derived state moves between playing, paused and stopped. */
  onPlaybackStateChanged(callback: (state: PlaybackState) => void): Unsubscribe {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  /**
   * Forgets everything learned from the stream so far and reports "stopped". For when the
   * source of that stream is gone (the helper process died or was shut down): its last
   * report ("playing", this position) will never be corrected by it again, and leaving it
   * in place would have consumers keep counting play time — and the next run's first
   * snapshot suppressed as "unchanged" — for something that is no longer happening.
   */
  reset(): void {
    this.currentPayload = {};
    this.currentIdentity = undefined;
    this.hasTrack = false;
    if (this.state !== "stopped") {
      this.state = "stopped";
      for (const listener of this.stateListeners) {
        listener("stopped");
      }
    }
  }

  /**
   * Estimates the current playback position in seconds: the last reported `elapsedTime`,
   * advanced by the wall-clock time since the payload was captured (scaled by
   * `playbackRate`) while playing, and clamped to `[0, duration]`. Returns 0 when no
   * numeric `elapsedTime` is known.
   */
  getPosition(): number {
    const { elapsedTime, timestamp, playbackRate, duration } = this.currentPayload;
    // Same reasoning as `toTrackInfo`'s `durationSec` guard above: a mid-track diff
    // can legitimately carry `elapsedTime: null`/`duration: null`. `null !== undefined`
    // is `true`, so the old `=== undefined`/`!== undefined` checks let a `null` through
    // as a real number — JS then coerces it to `0` in arithmetic (`Math.min(position,
    // null)` → `0`), silently clamping the reported position to 0 or under-reporting it
    // by the full previously-elapsed amount instead of just skipping the field.
    if (typeof elapsedTime !== "number") {
      return 0;
    }
    let position = elapsedTime;
    if (this.state === "playing" && timestamp) {
      const capturedAtSec = new Date(timestamp).getTime() / 1000;
      const rate = playbackRate ?? 1;
      position += Math.max(0, Date.now() / 1000 - capturedAtSec) * rate;
    }
    if (typeof duration === "number") {
      position = Math.min(position, duration);
    }
    return Math.max(0, position);
  }

  /** Feeds one raw stdout line from `mediaremote-adapter.pl stream` into the parser. */
  handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let event: StreamEvent;
    try {
      event = JSON.parse(trimmed) as StreamEvent;
    } catch {
      return;
    }
    if (event.type !== "data") {
      return;
    }

    this.currentPayload = event.diff
      ? { ...this.currentPayload, ...(event.payload ?? {}) }
      : (event.payload ?? {});

    const track = toTrackInfo(this.currentPayload);
    if (track) {
      const identity = trackIdentity(track);
      if (identity !== this.currentIdentity) {
        this.currentIdentity = identity;
        this.hasTrack = true;
        for (const listener of this.trackListeners) {
          listener(track);
        }
      }
    } else if (this.hasTrack) {
      this.hasTrack = false;
      this.currentIdentity = undefined;
    }

    const nextState: PlaybackState = !this.hasTrack
      ? "stopped"
      : this.currentPayload.playing
        ? "playing"
        : "paused";
    if (nextState !== this.state) {
      this.state = nextState;
      for (const listener of this.stateListeners) {
        listener(nextState);
      }
    }
  }
}

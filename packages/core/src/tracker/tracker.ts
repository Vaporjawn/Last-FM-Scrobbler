import { isEligibleForScrobble } from "../rules/is-eligible-for-scrobble.js";
import { computeTrackIdentity } from "./track-identity.js";
import type { CompiledFilter } from "../filters/filter-expression.js";
import type {
  PlaybackSource,
  PlaybackState,
  TrackInfo,
  Unsubscribe,
} from "@lastfm-scrobbler/shared-types";

/** Emitted when `Tracker` sees a genuinely new play begin (not a filtered or duplicate report); consumers use it to show or send "now playing". */
export interface TrackChangedEvent {
  readonly track: TrackInfo;
  /** Unix seconds — becomes the scrobble's timestamp if this play stays eligible. */
  readonly startedAt: number;
}

/** Emitted once per play, when enough of the track has been played to count as a scrobble; `startedAt` is the timestamp to submit it with. */
export interface ScrobbleEligibleEvent {
  readonly track: TrackInfo;
  readonly startedAt: number;
}

/** Callbacks the host passes to `Tracker`; both are optional and invoked synchronously from the tracker's own calls. */
export interface TrackerEvents {
  readonly onTrackChanged?: (event: TrackChangedEvent) => void;
  readonly onScrobbleEligible?: (event: ScrobbleEligibleEvent) => void;
}

/** Construction options for `Tracker`: the playback source to observe, the event callbacks, an optional exclusion filter, and an injectable clock (Unix seconds) for tests. */
export interface TrackerOptions {
  readonly source: PlaybackSource;
  readonly events: TrackerEvents;
  /** Tracks matching this filter are excluded entirely — no now-playing, no scrobble. */
  readonly filter?: CompiledFilter;
  readonly now?: () => number;
}

/**
 * Drives scrobble eligibility from a `PlaybackSource`'s raw events. Owns no timer
 * itself — the host calls `tick()` periodically (e.g. every second) while a track is
 * playing; this keeps the state machine a deterministic function of explicit calls,
 * not wall-clock side effects, which is what makes it possible to test without fake
 * timers or real delays.
 */
export class Tracker {
  private readonly source: PlaybackSource;
  private readonly events: TrackerEvents;
  private readonly filter: CompiledFilter | undefined;
  private readonly now: () => number;

  private unsubscribeTrack: Unsubscribe | undefined;
  private unsubscribeState: Unsubscribe | undefined;

  private playbackState: PlaybackState = "stopped";
  private currentTrack: TrackInfo | undefined;
  private currentIdentity: string | undefined;
  private startedAt = 0;
  private playedSec = 0;
  private lastAccumulatedAt = 0;
  private alreadyEligible = false;

  /** Stores the options only; nothing is subscribed until `start()`. The clock defaults to wall-clock Unix seconds. */
  constructor(options: TrackerOptions) {
    this.source = options.source;
    this.events = options.events;
    this.filter = options.filter;
    this.now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  /** Subscribes to the source's track-changed and playback-state events. Calling it twice without `stop()` in between leaves the first subscriptions unreleased. */
  start(): void {
    this.unsubscribeTrack = this.source.onTrackChanged((track) => {
      this.handleTrackChanged(track);
    });
    this.unsubscribeState = this.source.onPlaybackStateChanged((state) => {
      this.handlePlaybackStateChanged(state);
    });
  }

  /** Unsubscribes from the source. Per-play state is kept, so `tick()` could still report a track already being timed. */
  stop(): void {
    this.unsubscribeTrack?.();
    this.unsubscribeState?.();
    this.unsubscribeTrack = undefined;
    this.unsubscribeState = undefined;
  }

  /** Call periodically (e.g. every second) while the host app is running. */
  tick(): void {
    if (this.playbackState !== "playing" || !this.currentTrack) {
      return;
    }
    this.accumulate();
    this.checkEligibility();
  }

  /**
   * Starts a new play. A track matching the exclusion filter clears the current play
   * (so nothing is tracked or reported until the next track). Otherwise the track's
   * identity is compared to the current one and a repeat report of the same play is
   * ignored; a new play resets the played-time counter and eligibility flag and fires
   * `onTrackChanged`. The play's start time is when the event was received, not any
   * time the source supplied.
   */
  private handleTrackChanged(track: TrackInfo): void {
    if (this.filter?.test(track)) {
      this.currentTrack = undefined;
      this.currentIdentity = undefined;
      return;
    }

    const nowSec = this.now();
    const identity = computeTrackIdentity(track, nowSec);
    if (identity === this.currentIdentity) {
      return;
    }

    this.currentTrack = track;
    this.currentIdentity = identity;
    this.startedAt = nowSec;
    this.playedSec = 0;
    this.lastAccumulatedAt = nowSec;
    this.alreadyEligible = false;

    this.events.onTrackChanged?.({ track, startedAt: nowSec });
  }

  /**
   * Keeps the played-time counter honest across play/pause: time up to the change is
   * banked while the state was `playing`, and the accumulation point is restarted when
   * playback resumes so paused time is never counted.
   */
  private handlePlaybackStateChanged(state: PlaybackState): void {
    if (this.playbackState === "playing") {
      // Covers both a real transition out of "playing" (pause/stop) *and* a
      // redundant "playing" event fired while already playing. Nothing in the
      // `PlaybackSource` contract guarantees an adapter only emits a state change on
      // a genuine transition — accumulating unconditionally here (rather than only
      // when `state !== "playing"`) means a redundant event can never silently
      // discard the time played since the last accumulation point by resetting
      // `lastAccumulatedAt` without ever having added it to `playedSec` first.
      this.accumulate();
    } else if (state === "playing") {
      this.lastAccumulatedAt = this.now();
    }
    this.playbackState = state;
  }

  /** Adds the seconds elapsed since the last accumulation point to `playedSec` (never negative, so a clock step backwards cannot subtract time) and moves the point to now. */
  private accumulate(): void {
    const nowSec = this.now();
    this.playedSec += Math.max(0, nowSec - this.lastAccumulatedAt);
    this.lastAccumulatedAt = nowSec;
  }

  /** Fires `onScrobbleEligible` the first time the current play satisfies `isEligibleForScrobble`; the `alreadyEligible` flag keeps it to once per play. */
  private checkEligibility(): void {
    if (!this.currentTrack || this.alreadyEligible) {
      return;
    }
    const eligible = isEligibleForScrobble({
      ...(this.currentTrack.durationSec !== undefined
        ? { durationSec: this.currentTrack.durationSec }
        : {}),
      playedSec: this.playedSec,
    });
    if (eligible) {
      this.alreadyEligible = true;
      this.events.onScrobbleEligible?.({ track: this.currentTrack, startedAt: this.startedAt });
    }
  }
}

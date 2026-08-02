import { isEligibleForScrobble } from "../rules/is-eligible-for-scrobble.js";
import { computeTrackIdentity } from "./track-identity.js";
import type { CompiledFilter } from "../filters/filter-expression.js";
import type {
  PlaybackSource,
  PlaybackState,
  TrackInfo,
  Unsubscribe,
} from "@lastfm-scrobbler/shared-types";

export interface TrackChangedEvent {
  readonly track: TrackInfo;
  /** Unix seconds — becomes the scrobble's timestamp if this play stays eligible. */
  readonly startedAt: number;
}

export interface ScrobbleEligibleEvent {
  readonly track: TrackInfo;
  readonly startedAt: number;
}

export interface TrackerEvents {
  readonly onTrackChanged?: (event: TrackChangedEvent) => void;
  readonly onScrobbleEligible?: (event: ScrobbleEligibleEvent) => void;
}

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

  constructor(options: TrackerOptions) {
    this.source = options.source;
    this.events = options.events;
    this.filter = options.filter;
    this.now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  start(): void {
    this.unsubscribeTrack = this.source.onTrackChanged((track) => {
      this.handleTrackChanged(track);
    });
    this.unsubscribeState = this.source.onPlaybackStateChanged((state) => {
      this.handlePlaybackStateChanged(state);
    });
  }

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

  private handlePlaybackStateChanged(state: PlaybackState): void {
    if (this.playbackState === "playing" && state !== "playing") {
      this.accumulate();
    } else if (state === "playing") {
      this.lastAccumulatedAt = this.now();
    }
    this.playbackState = state;
  }

  private accumulate(): void {
    const nowSec = this.now();
    this.playedSec += Math.max(0, nowSec - this.lastAccumulatedAt);
    this.lastAccumulatedAt = nowSec;
  }

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

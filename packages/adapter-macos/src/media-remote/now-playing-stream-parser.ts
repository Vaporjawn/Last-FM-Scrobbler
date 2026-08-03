import type { PlaybackState, TrackInfo, Unsubscribe } from "@lastfm-scrobbler/shared-types";

/**
 * Loosely-typed shape of `mediaremote-adapter`'s "get"/"stream" payload. Every field is
 * optional — the adapter only ever guarantees `title`/`artist`/`playing`/`bundleIdentifier`
 * are non-null *when a payload represents valid media*; a track with no title is
 * reported as invalid (empty payload) by design. See vendor/mediaremote-adapter/VENDORED.md.
 */
interface NowPlayingPayload {
  readonly title?: string;
  readonly artist?: string;
  readonly album?: string;
  readonly duration?: number;
  readonly elapsedTime?: number;
  readonly playbackRate?: number;
  readonly playing?: boolean;
  readonly timestamp?: string;
  readonly bundleIdentifier?: string;
  readonly radioStationIdentifier?: string;
  readonly radioStationHash?: string;
}

interface StreamEvent {
  readonly type: string;
  readonly diff?: boolean;
  readonly payload?: NowPlayingPayload | null;
}

/** Converts one raw payload into a `TrackInfo`, or `undefined` for an invalid/empty one. */
function toTrackInfo(payload: NowPlayingPayload): TrackInfo | undefined {
  if (!payload.title) {
    return undefined;
  }
  // `!== undefined` isn't enough here: the vendored native adapter's diff protocol
  // legitimately emits a JSON `null` for a field that momentarily disappears while
  // the track identity stays the same (see stream.m's `createDiff`, which sets a
  // removed key to `NSNull`) — `duration`/`elapsedTime` are not among the fields it
  // preserves across polls, so a `{"duration":null}` diff is a real, observed shape,
  // not a hypothetical one. Passing `null` through as `durationSec` would violate the
  // `number | undefined` `TrackInfo` contract, so this only accepts a real number.
  const durationSec = typeof payload.duration === "number" ? payload.duration : undefined;
  return {
    title: payload.title,
    artist: payload.artist ?? "",
    ...(payload.album !== undefined ? { album: payload.album } : {}),
    ...(durationSec !== undefined ? { durationSec } : {}),
    sourceApp: payload.bundleIdentifier ?? "unknown",
    isStream: Boolean(payload.radioStationIdentifier ?? payload.radioStationHash),
  };
}

/** A stable key identifying "the same track" across payload diffs, for change detection. */
function trackIdentity(track: TrackInfo): string {
  return `${track.artist}::${track.title}::${track.album ?? ""}`;
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

  onTrackChanged(callback: (track: TrackInfo) => void): Unsubscribe {
    this.trackListeners.add(callback);
    return () => this.trackListeners.delete(callback);
  }

  onPlaybackStateChanged(callback: (state: PlaybackState) => void): Unsubscribe {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

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

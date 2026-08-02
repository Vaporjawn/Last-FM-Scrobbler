import { existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type {
  PlaybackSource,
  PlaybackState,
  TrackInfo,
  Unsubscribe,
} from "@lastfm-scrobbler/shared-types";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const PERL_BIN = "/usr/bin/perl";
const PERL_SCRIPT_PATH = join(packageDir, "vendor/mediaremote-adapter/bin/mediaremote-adapter.pl");
const FRAMEWORK_PATH = join(packageDir, "native-build/MediaRemoteAdapter.framework");

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

function toTrackInfo(payload: NowPlayingPayload): TrackInfo | undefined {
  if (!payload.title) {
    return undefined;
  }
  return {
    title: payload.title,
    artist: payload.artist ?? "",
    ...(payload.album !== undefined ? { album: payload.album } : {}),
    ...(payload.duration !== undefined ? { durationSec: payload.duration } : {}),
    sourceApp: payload.bundleIdentifier ?? "unknown",
    isStream: Boolean(payload.radioStationIdentifier ?? payload.radioStationHash),
  };
}

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
    if (elapsedTime === undefined) {
      return 0;
    }
    let position = elapsedTime;
    if (this.state === "playing" && timestamp) {
      const capturedAtSec = new Date(timestamp).getTime() / 1000;
      const rate = playbackRate ?? 1;
      position += Math.max(0, Date.now() / 1000 - capturedAtSec) * rate;
    }
    if (duration !== undefined) {
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

class MacosPlaybackSource implements PlaybackSource {
  private readonly parser = new NowPlayingStreamParser();
  private child: ChildProcessWithoutNullStreams | undefined;

  constructor() {
    if (!existsSync(FRAMEWORK_PATH)) {
      throw new Error(
        `MediaRemoteAdapter.framework not found at ${FRAMEWORK_PATH} — run ` +
          "`node packages/adapter-macos/scripts/build-native.mjs` (macOS + Xcode " +
          "command line tools required) before using createMacosPlaybackSource().",
      );
    }

    this.child = spawn(PERL_BIN, [PERL_SCRIPT_PATH, FRAMEWORK_PATH, "stream"]);
    this.child.on("error", (error: unknown) => {
      console.error("adapter-macos: mediaremote-adapter process error:", error);
    });

    const lines = createInterface({ input: this.child.stdout });
    lines.on("line", (line) => {
      this.parser.handleLine(line);
    });
  }

  onTrackChanged(callback: (track: TrackInfo) => void): Unsubscribe {
    return this.parser.onTrackChanged(callback);
  }

  onPlaybackStateChanged(callback: (state: PlaybackState) => void): Unsubscribe {
    return this.parser.onPlaybackStateChanged(callback);
  }

  getPosition(): Promise<number> {
    return Promise.resolve(this.parser.getPosition());
  }
}

/**
 * Implements `PlaybackSource` via MediaRemote — see
 * `packages/adapter-macos/vendor/mediaremote-adapter/VENDORED.md` and
 * `docs/adr/0008-macos-mediaremote-entitlement.md` for why this shells out to a
 * `perl`-hosted helper framework instead of calling the private framework directly.
 *
 * Throws if `MediaRemoteAdapter.framework` hasn't been built yet — run
 * `node packages/adapter-macos/scripts/build-native.mjs` first (macOS only).
 */
export function createMacosPlaybackSource(): PlaybackSource {
  return new MacosPlaybackSource();
}

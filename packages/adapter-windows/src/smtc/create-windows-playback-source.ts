import type { spawn as nodeSpawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  PlaybackSource,
  PlaybackState,
  TrackInfo,
  Unsubscribe,
} from "@lastfm-scrobbler/shared-types";
import { mapPayloadToTrackInfo } from "./map-payload-to-track-info.js";
import { mapPayloadToPlaybackState } from "./map-payload-to-playback-state.js";
import { resolveHelperPath, type ResolvedHelperPath } from "./resolve-helper-path.js";
import { SmtcHelperNotBuiltError } from "./smtc-helper-not-built-error.js";
import { spawnSmtcHelper, type SmtcHelperHandle } from "./spawn-smtc-helper.js";
import type { NowPlayingPayload } from "./now-playing-payload.js";

export interface CreateWindowsPlaybackSourceOptions {
  /** Injectable for testing; defaults to `node:child_process`'s `spawn`. */
  readonly spawnImpl?: typeof nodeSpawn;
  /** Injectable for testing; defaults to the real filesystem-based resolver. */
  readonly resolveHelperPathImpl?: (startDir: string) => ResolvedHelperPath;
  readonly onStderr?: (line: string) => void;
  /** Called when the helper process fails to spawn or exits unexpectedly — see
   * `spawnSmtcHelper`'s `onError` docstring. */
  readonly onError?: (error: unknown) => void;
}

function trackInfoEqual(a: TrackInfo | undefined, b: TrackInfo | undefined): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.title === b.title &&
    a.artist === b.artist &&
    a.album === b.album &&
    a.albumArtist === b.albumArtist &&
    a.durationSec === b.durationSec &&
    a.sourceApp === b.sourceApp &&
    a.isStream === b.isStream
  );
}

/**
 * Creates a `PlaybackSource` backed by Windows's System Media Transport Controls
 * (SMTC), via a small compiled helper process (`native/SmtcHelper`) that talks the
 * `Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager` WinRT API —
 * no Node.js binding exists for it directly. Unlike macOS's MediaRemote, SMTC is a
 * fully public, documented API with no entitlement lockdown, so the helper is spawned
 * directly rather than through a trampoline process (contrast
 * `packages/adapter-macos`). See docs/adr/0009-windows-smtc-integration.md.
 *
 * SMTC itself decides which running session is "the current session" (the one the user
 * would most likely want to control) when multiple apps are playing — unlike MPRIS on
 * Linux, this adapter doesn't need its own multi-source arbitration policy
 * (contrast `packages/adapter-linux`'s `PlayerRegistry`).
 *
 * The helper process is spawned lazily on first subscription and torn down once every
 * subscriber has unsubscribed, matching the other two adapters' lifecycle.
 */
export function createWindowsPlaybackSource(
  options: CreateWindowsPlaybackSourceOptions = {},
): PlaybackSource {
  const resolveHelperPathImpl = options.resolveHelperPathImpl ?? resolveHelperPath;

  const trackListeners = new Set<(track: TrackInfo) => void>();
  const stateListeners = new Set<(state: PlaybackState) => void>();
  let latestPayload: NowPlayingPayload | null = null;
  let helperHandle: SmtcHelperHandle | undefined;
  let lastEmittedTrack: TrackInfo | undefined;
  let lastEmittedState: PlaybackState | undefined;

  function handleEvent(payload: NowPlayingPayload | null): void {
    latestPayload = payload;

    // SMTC fires `TimelinePropertiesChanged` on ordinary playback-position ticks
    // (roughly once/sec for most players), not just on genuine track/state changes —
    // unlike this adapter, both siblings (macOS/MediaRemote, Linux/MPRIS) already
    // dedupe before notifying listeners. Without this, a single 4-minute song used to
    // fire `onTrackChanged` ~240 times and `onPlaybackStateChanged` "playing"
    // repeatedly with no real change, spamming any consumer that treats either event
    // as "something actually changed" (a Last.fm now-playing update, a scrobble-
    // eligibility timer reset).
    if (payload) {
      const track = mapPayloadToTrackInfo(payload);
      if (track && !trackInfoEqual(track, lastEmittedTrack)) {
        lastEmittedTrack = track;
        for (const listener of trackListeners) {
          listener(track);
        }
      }
    }

    const state = payload ? mapPayloadToPlaybackState(payload) : "stopped";
    if (state !== lastEmittedState) {
      lastEmittedState = state;
      for (const listener of stateListeners) {
        listener(state);
      }
    }
  }

  function ensureStarted(): void {
    if (helperHandle) {
      return;
    }

    const startDir = dirname(fileURLToPath(import.meta.url));
    const { helperPath, helperBuilt } = resolveHelperPathImpl(startDir);
    if (!helperBuilt) {
      throw new SmtcHelperNotBuiltError(helperPath);
    }

    // Captured by reference in `onExit` below (rather than reading the outer
    // `helperHandle` variable directly) so a *stale* exit notification — the old
    // process's `exit` event finally firing after a stop-then-immediate-restart has
    // already assigned a new handle — can't clobber the new, still-live handle.
    const handle: SmtcHelperHandle = spawnSmtcHelper({
      helperPath,
      onEvent: handleEvent,
      // If the helper process crashes or is externally killed after successfully
      // starting, clear `helperHandle` so a later `ensureStarted()` call (the next
      // subscription, or a caller that notices playback has gone stale and re-
      // subscribes) can actually respawn it — without this, `helperHandle` stayed
      // truthy forever and the adapter was permanently stuck reporting the last-known
      // (stale) track/state with nothing logged or surfaced anywhere.
      onExit: () => {
        if (helperHandle === handle) {
          helperHandle = undefined;
        }
      },
      ...(options.spawnImpl ? { spawnImpl: options.spawnImpl } : {}),
      ...(options.onStderr ? { onStderr: options.onStderr } : {}),
      ...(options.onError ? { onError: options.onError } : {}),
    });
    helperHandle = handle;
  }

  function stopIfNoSubscribers(): void {
    if (trackListeners.size === 0 && stateListeners.size === 0) {
      helperHandle?.stop();
      helperHandle = undefined;
      // Clear the dedup baseline too, so a later restart doesn't skip re-emitting the
      // first track/state it sees just because it happens to match whatever was last
      // reported before the previous stop.
      lastEmittedTrack = undefined;
      lastEmittedState = undefined;
    }
  }

  return {
    onTrackChanged(callback: (track: TrackInfo) => void): Unsubscribe {
      trackListeners.add(callback);
      ensureStarted();
      return () => {
        trackListeners.delete(callback);
        stopIfNoSubscribers();
      };
    },

    onPlaybackStateChanged(callback: (state: PlaybackState) => void): Unsubscribe {
      stateListeners.add(callback);
      ensureStarted();
      return () => {
        stateListeners.delete(callback);
        stopIfNoSubscribers();
      };
    },

    getPosition(): Promise<number> {
      const position = latestPayload?.elapsedSec;
      return Promise.resolve(typeof position === "number" ? position : 0);
    },
  };
}

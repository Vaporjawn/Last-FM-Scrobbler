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
import { spawnSmtcHelper, type SmtcHelperHandle } from "./spawn-smtc-helper.js";
import type { NowPlayingPayload } from "./now-playing-payload.js";

export class SmtcHelperNotBuiltError extends Error {
  constructor(helperPath: string) {
    super(
      `SmtcHelper.exe has not been built yet (expected at "${helperPath}"). Run ` +
        `"pnpm --filter @lastfm-scrobbler/adapter-windows build:native" (Windows + the ` +
        `.NET 8 SDK required) before starting the Windows adapter.`,
    );
    this.name = "SmtcHelperNotBuiltError";
  }
}

export interface CreateWindowsPlaybackSourceOptions {
  /** Injectable for testing; defaults to `node:child_process`'s `spawn`. */
  readonly spawnImpl?: typeof nodeSpawn;
  /** Injectable for testing; defaults to the real filesystem-based resolver. */
  readonly resolveHelperPathImpl?: (startDir: string) => ResolvedHelperPath;
  readonly onStderr?: (line: string) => void;
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

  function handleEvent(payload: NowPlayingPayload | null): void {
    latestPayload = payload;

    if (payload) {
      const track = mapPayloadToTrackInfo(payload);
      if (track) {
        for (const listener of trackListeners) {
          listener(track);
        }
      }
    }

    const state = payload ? mapPayloadToPlaybackState(payload) : "stopped";
    for (const listener of stateListeners) {
      listener(state);
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

    helperHandle = spawnSmtcHelper({
      helperPath,
      onEvent: handleEvent,
      ...(options.spawnImpl ? { spawnImpl: options.spawnImpl } : {}),
      ...(options.onStderr ? { onStderr: options.onStderr } : {}),
    });
  }

  function stopIfNoSubscribers(): void {
    if (trackListeners.size === 0 && stateListeners.size === 0) {
      helperHandle?.stop();
      helperHandle = undefined;
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

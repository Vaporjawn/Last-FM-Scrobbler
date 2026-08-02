import { sessionBus as defaultSessionBus, type MessageBus } from "dbus-next";
import { PlayerRegistry, type ActiveSnapshot } from "./player-registry.js";
import { listMprisPlayerBusNames, watchMprisPlayerLifecycle } from "./mpris-player-bus-names.js";
import { watchMprisPlayer, type Unsubscribe as WatchUnsubscribe } from "./watch-mpris-player.js";
import { queryMprisPosition } from "./query-mpris-position.js";
import type {
  PlaybackSource,
  PlaybackState,
  TrackInfo,
  Unsubscribe,
} from "@lastfm-scrobbler/shared-types";

export interface CreateLinuxPlaybackSourceOptions {
  /** Injectable for testing; defaults to `dbus-next`'s real session bus. */
  readonly sessionBus?: () => MessageBus;
  readonly onError?: (error: unknown) => void;
  /** Injectable clock, forwarded to the internal `PlayerRegistry`; defaults to the real clock. */
  readonly now?: () => number;
}

function tracksEqual(a: TrackInfo | null, b: TrackInfo | null): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
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
 * Creates a `PlaybackSource` backed by MPRIS2 (Media Player Remote Interfacing
 * Specification) over D-Bus — the standard Linux desktop protocol for exposing media
 * player state, implemented by Spotify, VLC, browsers (via extensions/plugins), and
 * most other Linux media players. Unlike macOS's MediaRemote, MPRIS2 is a documented,
 * public, unrestricted D-Bus interface — no private-API workarounds needed.
 *
 * Multiple players can be running (and even simultaneously "Playing") at once; which
 * one this source reports is resolved by `PlayerRegistry` per
 * docs/adr/0005-multi-source-and-track-identity-policy.md.
 *
 * The D-Bus connection is established lazily on first subscription and torn down once
 * every subscriber has unsubscribed, matching `packages/adapter-macos`'s lifecycle.
 */
export function createLinuxPlaybackSource(
  options: CreateLinuxPlaybackSourceOptions = {},
): PlaybackSource {
  const getSessionBus = options.sessionBus ?? defaultSessionBus;

  const trackListeners = new Set<(track: TrackInfo) => void>();
  const stateListeners = new Set<(state: PlaybackState) => void>();
  const registry = new PlayerRegistry(options.now ? { now: options.now } : {});
  const playerWatchers = new Map<string, WatchUnsubscribe>();

  let bus: MessageBus | undefined;
  let lifecycleUnsubscribe: WatchUnsubscribe | undefined;
  let lastEmitted: ActiveSnapshot = { track: null, state: "stopped" };
  let starting: Promise<void> | undefined;

  function emitIfChanged(): void {
    const active = registry.getActive();

    if (active.state !== lastEmitted.state) {
      for (const listener of stateListeners) {
        listener(active.state);
      }
    }
    if (!tracksEqual(active.track, lastEmitted.track) && active.track) {
      for (const listener of trackListeners) {
        listener(active.track);
      }
    }
    lastEmitted = active;
  }

  async function watchPlayer(busName: string, activeBus: MessageBus): Promise<void> {
    try {
      const unsubscribe = await watchMprisPlayer(activeBus, busName, (track, state) => {
        registry.update(busName, track, state);
        emitIfChanged();
      });
      playerWatchers.set(busName, unsubscribe);
    } catch (error) {
      // A player can vanish between being discovered and being watched (real desktop
      // player lifecycle is racy) — not a fatal adapter error, just skip it.
      options.onError?.(error);
    }
  }

  function unwatchPlayer(busName: string): void {
    playerWatchers.get(busName)?.();
    playerWatchers.delete(busName);
    registry.remove(busName);
    emitIfChanged();
  }

  async function start(): Promise<void> {
    const activeBus = getSessionBus();
    bus = activeBus;

    const initialNames = await listMprisPlayerBusNames(activeBus);
    await Promise.all(initialNames.map((name) => watchPlayer(name, activeBus)));

    lifecycleUnsubscribe = await watchMprisPlayerLifecycle(activeBus, (change) => {
      if (change.appeared) {
        void watchPlayer(change.busName, activeBus);
      } else {
        unwatchPlayer(change.busName);
      }
    });
  }

  function ensureStarted(): void {
    if (starting) {
      return;
    }
    starting = start().catch((error: unknown) => {
      options.onError?.(error);
    });
  }

  function stopIfNoSubscribers(): void {
    if (trackListeners.size > 0 || stateListeners.size > 0) {
      return;
    }
    lifecycleUnsubscribe?.();
    lifecycleUnsubscribe = undefined;
    for (const unsubscribe of playerWatchers.values()) {
      unsubscribe();
    }
    playerWatchers.clear();
    bus?.disconnect();
    bus = undefined;
    starting = undefined;
    lastEmitted = { track: null, state: "stopped" };
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
      const activeBusName = registry.getActiveBusName();
      if (!bus || !activeBusName) {
        return Promise.resolve(0);
      }
      return queryMprisPosition(bus, activeBusName);
    },
  };
}

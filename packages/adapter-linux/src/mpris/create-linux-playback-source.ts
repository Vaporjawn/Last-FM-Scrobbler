import type { MessageBus } from "dbus-next";
import { createDefaultSessionBus } from "./create-default-session-bus.js";
import { listMprisPlayerBusNames } from "./list-mpris-player-bus-names.js";
import { PlayerRegistry, type ActiveSnapshot } from "./player-registry.js";
import { queryMprisPosition } from "./query-mpris-position.js";
import { watchMprisPlayerLifecycle } from "./watch-mpris-player-lifecycle.js";
import { watchMprisPlayer } from "./watch-mpris-player.js";
import type {
  PlaybackSource,
  PlaybackState,
  TrackInfo,
  Unsubscribe,
} from "@lastfm-scrobbler/shared-types";
import { tracksEqual } from "./tracks-equal.js";

/** Options for `createLinuxPlaybackSource`; every field is optional and mainly exists for tests and hosts. */
export interface CreateLinuxPlaybackSourceOptions {
  /** Injectable for testing; defaults to `dbus-next`'s real session bus. */
  readonly sessionBus?: () => MessageBus;
  /**
   * The bus address to connect to when `sessionBus` is not supplied; defaults to
   * `$DBUS_SESSION_BUS_ADDRESS`, then the systemd per-user socket. It is passed through
   * `normalizeDbusAddress` so `dbus-next` never loads the native `usocket` addon, which
   * crashes the packaged Electron app (see that function's docstring).
   */
  readonly busAddress?: string;
  /**
   * Receives non-fatal failures (bus connection errors, a player that could not be
   * watched, a failed startup). Without it these are swallowed rather than thrown.
   */
  readonly onError?: (error: unknown) => void;
  /** Injectable clock, forwarded to the internal `PlayerRegistry`; defaults to the real clock. */
  readonly now?: () => number;
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
  const getSessionBus =
    options.sessionBus ?? ((): MessageBus => createDefaultSessionBus(options.busAddress));

  const trackListeners = new Set<(track: TrackInfo) => void>();
  const stateListeners = new Set<(state: PlaybackState) => void>();
  const registry = new PlayerRegistry(options.now ? { now: options.now } : {});
  const playerWatchers = new Map<string, Unsubscribe>();

  let bus: MessageBus | undefined;
  let lifecycleUnsubscribe: Unsubscribe | undefined;
  let lastEmitted: ActiveSnapshot = { track: null, state: "stopped" };
  let starting: Promise<void> | undefined;
  // Every asynchronous step below (listing players, opening a player's proxy, setting up
  // the lifecycle watcher) can finish after the situation that started it has changed:
  // the last listener left, or the player already vanished. `epoch` changes on every
  // teardown, and `watchTokens` holds the one watch attempt per bus name that is still
  // wanted; a step whose epoch or token is no longer current cleans up after itself
  // instead of re-registering something nobody will ever release.
  let epoch = 0;
  const watchTokens = new Map<string, symbol>();

  /**
   * Recomputes the registry's active player and notifies listeners of whatever differs
   * from the last emission: state listeners when the state changed, track listeners when
   * the track changed to a non-null value (a change to "no track" is never sent to them).
   */
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

  /**
   * Starts watching one MPRIS player and feeds its updates into the registry. Replaces any
   * existing watcher for the same bus name. If the source was torn down, or the player was
   * unwatched, while the asynchronous setup was in flight, the fresh watcher is released
   * immediately instead of being registered.
   */
  async function watchPlayer(
    busName: string,
    activeBus: MessageBus,
    sessionEpoch: number,
  ): Promise<void> {
    // A repeated "appeared" for a name we already watch replaces the old watcher.
    playerWatchers.get(busName)?.();
    playerWatchers.delete(busName);

    const token = Symbol(busName);
    watchTokens.set(busName, token);
    /** True while this watch attempt is still the wanted one for its bus name and session. */
    const isCurrent = (): boolean => sessionEpoch === epoch && watchTokens.get(busName) === token;

    try {
      const unsubscribe = await watchMprisPlayer(activeBus, busName, (track, state) => {
        if (!isCurrent()) {
          return;
        }
        registry.update(busName, track, state);
        emitIfChanged();
      });
      if (!isCurrent()) {
        unsubscribe();
        return;
      }
      playerWatchers.set(busName, unsubscribe);
    } catch (error) {
      // A player can vanish between being discovered and being watched (real desktop
      // player lifecycle is racy) — not a fatal adapter error, just skip it.
      if (isCurrent()) {
        options.onError?.(error);
      }
    }
  }

  /**
   * Stops watching a player that left the bus, invalidates any watch attempt still in
   * flight for it, drops it from the registry, and emits so listeners see the new
   * active player (or "stopped" if none remain).
   */
  function unwatchPlayer(busName: string): void {
    watchTokens.delete(busName);
    playerWatchers.get(busName)?.();
    playerWatchers.delete(busName);
    registry.remove(busName);
    emitIfChanged();
  }

  /**
   * Opens the session bus, watches every MPRIS player already running, then subscribes to
   * player start/stop so later arrivals and departures are tracked. The lifecycle
   * subscription is made after the initial listing; each step re-checks `sessionEpoch`
   * so a teardown that happened mid-await abandons the rest of the startup.
   */
  async function start(sessionEpoch: number): Promise<void> {
    const activeBus = getSessionBus();
    bus = activeBus;
    // `getSessionBus()` returns synchronously, but the underlying connection/`Hello`
    // handshake completes asynchronously — a failure there (no session bus reachable,
    // the bus restarting, a logout mid-session) is forwarded via `bus.emit('error',
    // ...)` per dbus-next's own Bus/Connection implementation. With no listener
    // attached, Node's default EventEmitter behavior for an unhandled `'error'` event
    // is to throw, crashing the entire host process — this routes it through the same
    // `onError` callback every other failure path in this adapter already uses.
    activeBus.on("error", (error: unknown) => {
      options.onError?.(error);
    });

    const initialNames = await listMprisPlayerBusNames(activeBus);
    if (sessionEpoch !== epoch) {
      return;
    }
    await Promise.all(initialNames.map((name) => watchPlayer(name, activeBus, sessionEpoch)));
    if (sessionEpoch !== epoch) {
      return;
    }

    const unsubscribeLifecycle = await watchMprisPlayerLifecycle(activeBus, (change) => {
      if (change.appeared) {
        void watchPlayer(change.busName, activeBus, sessionEpoch);
      } else {
        unwatchPlayer(change.busName);
      }
    });
    if (sessionEpoch !== epoch) {
      unsubscribeLifecycle();
      return;
    }
    lifecycleUnsubscribe = unsubscribeLifecycle;
  }

  /** Kicks off `start` for the current epoch once; later calls are no-ops until teardown. */
  function ensureStarted(): void {
    if (starting) {
      return;
    }
    starting = start(epoch).catch((error: unknown) => {
      options.onError?.(error);
    });
  }

  /**
   * Tears everything down once the last track and state listener has unsubscribed:
   * bumps the epoch (so in-flight async steps abandon themselves), releases the lifecycle
   * and per-player watchers, clears the registry, disconnects the bus, and resets the
   * source so the next subscription starts fresh.
   */
  function stopIfNoSubscribers(): void {
    if (trackListeners.size > 0 || stateListeners.size > 0) {
      return;
    }
    epoch += 1;
    lifecycleUnsubscribe?.();
    lifecycleUnsubscribe = undefined;
    for (const unsubscribe of playerWatchers.values()) {
      unsubscribe();
    }
    playerWatchers.clear();
    watchTokens.clear();
    registry.clear();
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

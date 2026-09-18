import { isNetworkError } from "./is-network-error.js";

/** Current connectivity/offline-queue status, pushed to `apps/desktop`'s renderer
 * over IPC (see `shared/network-status-api.ts`) and reflected in the tray tooltip. */
export interface NetworkStatus {
  /** `null` until the first `reportSuccess`/classified `reportFailure` call — "not
   * yet known", not "offline". Stays `true`/`false` afterward; never reverts to
   * `null`. */
  readonly online: boolean | null;
  readonly pendingCount: number;
  /** Unix seconds of the last `reportSuccess()` call, or `null` if there hasn't been
   * one yet this run. */
  readonly lastSyncedAt: number | null;
}

/** The one `ScrobbleQueue` method this module needs — kept narrow for easy testing,
 * same convention as `packages/core`'s other client-facing interfaces
 * (`LastfmDataClient`, `TrackActionsClient`). */
export interface QueueCountSource {
  count(): number;
}

export interface NetworkStatusMonitorOptions {
  readonly queue: QueueCountSource;
}

type Listener = (status: NetworkStatus) => void;

/**
 * Aggregates connectivity signal from every place the app already talks to Last.fm/
 * Libre.fm/ListenBrainz — the scrobble-drain loop (`wire-scrobbling.ts`) and the
 * Last.fm data/track-action/auth IPC handlers (via `reportNetworkOutcome`) — into one
 * shared, subscribable status. Deliberately has no timer and makes no network calls
 * of its own; see `docs/adr/0011-network-status-detection.md` for why. `online` only
 * ever changes via an explicit `reportSuccess`/classified `reportFailure` call — it
 * never flips to `false` from an application-level error (a bad session, a rate
 * limit, "artist not found"), since those prove the network path works fine.
 */
export class NetworkStatusMonitor {
  private readonly queue: QueueCountSource;
  private online: boolean | null = null;
  private lastSyncedAt: number | null = null;
  private readonly listeners = new Set<Listener>();

  constructor(options: NetworkStatusMonitorOptions) {
    this.queue = options.queue;
  }

  reportSuccess(): void {
    this.online = true;
    this.lastSyncedAt = Math.floor(Date.now() / 1000);
    this.emit();
  }

  /** No-ops (and does not notify subscribers) unless `isNetworkError(error)` is true —
   * see this class's own docstring. */
  reportFailure(error: unknown): void {
    if (!isNetworkError(error)) {
      return;
    }
    this.online = false;
    this.emit();
  }

  /** Re-reads `queue.count()` and notifies subscribers — call after any enqueue/drain
   * that could have changed it, so a pushed status stays current even between
   * connectivity changes (e.g. successfully draining 10 items while already online). */
  reportQueueChanged(): void {
    this.emit();
  }

  getStatus(): NetworkStatus {
    return {
      online: this.online,
      pendingCount: this.queue.count(),
      lastSyncedAt: this.lastSyncedAt,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      listener(status);
    }
  }
}

import type { AccountStore, LastfmClient, ScrobbleEligibleEvent, ScrobbleQueue } from "@lastfm-scrobbler/core";

const DEFAULT_DRAIN_INTERVAL_MS = 60_000;
const DRAIN_BATCH_SIZE = 50;
/** Notify only once submission has failed this many *consecutive* drain cycles
 * (roughly this many minutes of being unable to reach Last.fm, at the default
 * interval) — not on every single retry, which would spam a notification every
 * `drainIntervalMs` for as long as an outage lasts. */
const FAILURE_NOTIFICATION_THRESHOLD = 3;

/** A scrobble that was actually accepted by Last.fm in a drain batch — enough
 * identifying info for a "Scrobbled: …" notification, see `onScrobbled` below. */
export interface ScrobbledTrack {
  readonly artist: string;
  readonly track: string;
}

/** The subset of `LastfmClient` this module needs — kept narrow for easy testing. */
export interface ScrobblingClient {
  scrobble: LastfmClient["scrobble"];
}

export interface WireScrobblingOptions {
  readonly queue: ScrobbleQueue;
  readonly accountStore: AccountStore;
  /** Constructs a session-keyed client on demand — scrobble submission is the only
   * operation in this app that needs a session key, so there's no reason to hold a
   * session-keyed `LastfmClient` around outside of a drain cycle. */
  readonly createSessionClient: (sessionKey: string) => ScrobblingClient;
  readonly drainIntervalMs?: number;
  /** Called once per drain batch that accepts at least one scrobble — e.g. to show a
   * native "Scrobbled: …" notification (see `main/index.ts`). This is a background
   * process with no other user-visible feedback otherwise, unlike the renderer's
   * love/unlove/addTags actions (see `NowPlayingPage`'s snackbars) — those are
   * user-initiated with the window necessarily open; scrobbling happens unattended,
   * often with the window hidden (see docs/modules/desktop.md's "Background app"
   * section), which is exactly what a native OS notification is for. Optional —
   * defaults to a no-op. */
  readonly onScrobbled?: (items: readonly ScrobbledTrack[]) => void;
  /** Called once submission has failed `FAILURE_NOTIFICATION_THRESHOLD` consecutive
   * drain cycles in a row (not every single retry — see that constant's comment).
   * Optional — defaults to a no-op. */
  readonly onScrobbleFailed?: (reason: string) => void;
}

export interface ScrobblingHandle {
  /** Pass as `Tracker`'s `events.onScrobbleEligible` — enqueues the eligible play. */
  onScrobbleEligible: (event: ScrobbleEligibleEvent) => void;
  /** Exposed for tests/manual triggering; also runs automatically on `drainIntervalMs`. */
  drainOnce: () => Promise<void>;
  stop: () => void;
}

/**
 * Connects `Tracker`'s scrobble-eligible events to `ScrobbleQueue` (immediate,
 * synchronous enqueue — never lost even if this process crashes right after) and
 * periodically drains the queue to Last.fm using whichever account is currently active.
 *
 * If no account is active, `drainOnce` is a no-op — scrobbles simply accumulate in the
 * queue (bounded by `packages/core`'s `ScrobbleQueue` eviction policy, see
 * docs/adr/0006-offline-queue-persistence.md) until the user logs in.
 */
export function wireScrobbling(options: WireScrobblingOptions): ScrobblingHandle {
  const { queue, accountStore, createSessionClient, onScrobbled, onScrobbleFailed } = options;
  let consecutiveFailures = 0;

  function onScrobbleEligible(event: ScrobbleEligibleEvent): void {
    queue.enqueue({
      artist: event.track.artist,
      track: event.track.title,
      timestamp: event.startedAt,
      ...(event.track.album ? { album: event.track.album } : {}),
      ...(event.track.albumArtist ? { albumArtist: event.track.albumArtist } : {}),
      ...(event.track.durationSec !== undefined ? { durationSec: event.track.durationSec } : {}),
    });
  }

  async function drainOnce(): Promise<void> {
    const active = await accountStore.getActiveAccount();
    if (!active) {
      return;
    }

    const batch = queue.dequeueBatch(DRAIN_BATCH_SIZE);
    if (batch.length === 0) {
      return;
    }

    const client = createSessionClient(active.sessionKey);

    try {
      const result = await client.scrobble(
        batch.map((item) => ({
          artist: item.artist,
          track: item.track,
          timestamp: item.timestamp,
          ...(item.album !== undefined ? { album: item.album } : {}),
          ...(item.albumArtist !== undefined ? { albumArtist: item.albumArtist } : {}),
          ...(item.durationSec !== undefined ? { durationSec: item.durationSec } : {}),
        })),
      );

      const accepted: ScrobbledTrack[] = [];
      batch.forEach((item, index) => {
        const itemResult = result.results[index];
        if (!itemResult || itemResult.ignoredCode === 0) {
          queue.remove([item.id]);
          accepted.push({ artist: item.artist, track: item.track });
        } else {
          queue.recordFailure(item.id, {
            retryable: itemResult.retryable,
            reason: `Last.fm ignored this scrobble (code ${itemResult.ignoredCode})`,
          });
        }
      });

      // A batch that reached Last.fm at all (even if every item was individually
      // ignored) means connectivity is fine — any ongoing outage has recovered.
      consecutiveFailures = 0;
      if (accepted.length > 0) {
        onScrobbled?.(accepted);
      }
    } catch (error) {
      // Whole-batch failure (network error, Last.fm outage, rate limit, ...) — every
      // item in this batch gets the same treatment: keep it, note why, try again later.
      const reason = error instanceof Error ? error.message : String(error);
      for (const item of batch) {
        queue.recordFailure(item.id, { retryable: true, reason });
      }
      consecutiveFailures += 1;
      if (consecutiveFailures === FAILURE_NOTIFICATION_THRESHOLD) {
        onScrobbleFailed?.(reason);
      }
    }
  }

  const intervalHandle = setInterval(() => {
    void drainOnce();
  }, options.drainIntervalMs ?? DEFAULT_DRAIN_INTERVAL_MS);

  return {
    onScrobbleEligible,
    drainOnce,
    stop: () => {
      clearInterval(intervalHandle);
    },
  };
}

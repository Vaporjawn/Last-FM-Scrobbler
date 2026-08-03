import type {
  AccountStore,
  ScrobbleEligibleEvent,
  ScrobbleQueue,
  ScrobblingClient,
  TrackChangedEvent,
} from "@lastfm-scrobbler/core";

const DEFAULT_DRAIN_INTERVAL_MS = 60_000;
const DRAIN_BATCH_SIZE = 50;
/** Notify only once submission has failed this many *consecutive* drain cycles
 * (roughly this many minutes of being unable to reach any connected service, at the
 * default interval) — not on every single retry, which would spam a notification
 * every `drainIntervalMs` for as long as an outage lasts. */
const FAILURE_NOTIFICATION_THRESHOLD = 3;

/** A scrobble that was actually accepted by at least one connected service in a drain
 * batch — enough identifying info for a "Scrobbled: …" notification, see `onScrobbled`
 * below. */
export interface ScrobbledTrack {
  readonly artist: string;
  readonly track: string;
}

/** Builds the optional album/albumArtist/durationSec fields shared by both
 * `client.updateNowPlaying` calls this module makes — `onScrobbleEligible`'s enqueue
 * and `onTrackChanged`'s live "now playing" push both start from the same
 * `TrackChangedEvent`/`ScrobbleEligibleEvent`'s `.track`, and `exactOptionalPropertyTypes`
 * means each optional field must be omitted entirely rather than set to `undefined` —
 * hence the conditional-spread idiom, centralized here so a shape change only needs
 * updating once instead of twice. */
function toOptionalTrackFields(track: {
  readonly album?: string;
  readonly albumArtist?: string;
  readonly durationSec?: number;
}): { album?: string; albumArtist?: string; durationSec?: number } {
  return {
    ...(track.album ? { album: track.album } : {}),
    ...(track.albumArtist ? { albumArtist: track.albumArtist } : {}),
    ...(track.durationSec !== undefined ? { durationSec: track.durationSec } : {}),
  };
}

/**
 * One scrobbling destination this module can fan a batch out to — Last.fm (the
 * built-in `accountStore`/`createSessionClient` pair below) plus, optionally, any
 * number of additional services (Libre.fm, ListenBrainz — see `main/index.ts`'s
 * `services` construction). `id` is used only for log/failure-reason text, not for any
 * behavioral branching — every connected service is treated identically by
 * `drainOnce`/`onTrackChanged`.
 */
export interface ScrobblingServiceConnection {
  readonly id: string;
  /** Resolves to a ready-to-use client for whichever account is currently
   * connected/active for this service right now, or `undefined` if nothing is
   * connected — called fresh on every drain/now-playing cycle rather than captured
   * once, so connecting or switching accounts takes effect on the very next cycle
   * with no restart needed (same freshness convention `settingsStore.get()` elsewhere
   * in `main/index.ts` already relies on). */
  readonly getClient: () => Promise<ScrobblingClient | undefined>;
}

export interface WireScrobblingOptions {
  readonly queue: ScrobbleQueue;
  /** Last.fm's account store — kept as its own named field (rather than folded into
   * `additionalServices`) since it's this app's original and still-primary scrobbling
   * destination, and every existing caller/test already supplies it this way. Optional
   * so scrobbling can still run when only a `additionalServices` entry (Libre.fm/
   * ListenBrainz) is connected and Last.fm itself has no configured API key — see
   * `main/index.ts`'s gating. */
  readonly accountStore?: AccountStore;
  /** Constructs a session-keyed Last.fm client on demand — scrobble submission is the
   * only operation in this app that needs a session key, so there's no reason to hold
   * a session-keyed `LastfmClient` around outside of a drain cycle. */
  readonly createSessionClient?: (sessionKey: string) => ScrobblingClient;
  /** Any additional connected services (Libre.fm, ListenBrainz) to submit alongside
   * Last.fm — see `ScrobblingServiceConnection`. Every queued scrobble is submitted to
   * every currently-connected entry here *and* to Last.fm (when configured) in
   * parallel, per this app's "submit to all connected services at once" model — not a
   * single active service you switch between. Defaults to none, which reduces every
   * behavior below to exactly this module's original single-service (Last.fm-only)
   * semantics. */
  readonly additionalServices?: readonly ScrobblingServiceConnection[];
  readonly drainIntervalMs?: number;
  /** Called once per drain batch that at least one connected service accepted at
   * least one scrobble from — e.g. to show a native "Scrobbled: …" notification (see
   * `main/index.ts`). This is a background process with no other user-visible
   * feedback otherwise, unlike the renderer's love/unlove/addTags actions (see
   * `NowPlayingPage`'s snackbars) — those are user-initiated with the window
   * necessarily open; scrobbling happens unattended, often with the window hidden
   * (see docs/modules/desktop.md's "Background app" section), which is exactly what a
   * native OS notification is for. Optional — defaults to a no-op. */
  readonly onScrobbled?: (items: readonly ScrobbledTrack[]) => void;
  /** Called once *every currently-connected service* has failed to submit
   * `FAILURE_NOTIFICATION_THRESHOLD` consecutive drain cycles in a row (not every
   * single retry — see that constant's comment, and not just one out of several
   * connected services blipping — see `drainOnce`'s docstring for why). Optional —
   * defaults to a no-op. */
  readonly onScrobbleFailed?: (reason: string) => void;
}

export interface ScrobblingHandle {
  /** Pass as `Tracker`'s `events.onScrobbleEligible` — enqueues the eligible play. */
  onScrobbleEligible: (event: ScrobbleEligibleEvent) => void;
  /** Pass as `Tracker`'s `events.onTrackChanged` — pushes a real-time "now playing"
   * status (`client.updateNowPlaying`) to every currently-connected service, so a
   * track shows up there *as they're listening*, not just once it's actually
   * scrobbled (after the eligibility threshold — see `onScrobbleEligible`/
   * `isEligibleForScrobble`). Best-effort per service: no connected services, or a
   * failed/rejected request to one of them, is silently ignored rather than retried
   * or queued — by the time a retry would land, the "now playing" status it was for
   * would likely already be stale, unlike a scrobble (which has a real historical
   * timestamp and is worth retrying via the persistent queue `onScrobbleEligible`
   * uses) — and one service's failure never prevents the update from still reaching
   * every other connected service. Returns a `Promise` (even though `Tracker`'s
   * `onTrackChanged` type only requires `void`) so callers that want to await it —
   * tests, mainly — can. */
  onTrackChanged: (event: TrackChangedEvent) => Promise<void>;
  /** Exposed for tests/manual triggering; also runs automatically on `drainIntervalMs`. */
  drainOnce: () => Promise<void>;
  stop: () => void;
}

/** A `ScrobblingServiceConnection` plus whichever client `getClient()` resolved to
 * this cycle, once it's known to be connected — narrows away the `undefined` case so
 * downstream code doesn't need to re-check it. */
interface ConnectedService {
  readonly id: string;
  readonly client: ScrobblingClient;
}

/**
 * Connects `Tracker`'s scrobble-eligible events to `ScrobbleQueue` (immediate,
 * synchronous enqueue — never lost even if this process crashes right after) and
 * periodically drains the queue, submitting each batch to *every* currently-connected
 * service (Last.fm plus any `additionalServices`) in parallel — this app's "submit to
 * all connected services at once" model (as opposed to a single active service you
 * switch between).
 *
 * If no service is connected, `drainOnce` is a no-op — scrobbles simply accumulate in
 * the queue (bounded by `packages/core`'s `ScrobbleQueue` eviction policy, see
 * docs/adr/0006-offline-queue-persistence.md) until at least one service is connected.
 *
 * The queue itself has no per-service delivery tracking (one row per scrobble, not one
 * per scrobble-per-service) — a scrobble is only removed once *every* connected
 * service has either accepted it or permanently (non-retryably) rejected it. If a
 * scrobble is still retryable on any one connected service, the *whole* item is kept
 * and resubmitted to *every* connected service again next cycle, including ones that
 * already accepted it — a deliberate, documented tradeoff (see
 * `docs/adr/0006-offline-queue-persistence.md`) rather than the added complexity of
 * per-(item, service) tracking: a resubmitted duplicate is harmless in practice
 * (Last.fm itself already tolerates near-duplicate resubmission after a transient
 * failure — this app has always relied on that for its single-service retry behavior,
 * see `isRetryableScrobbleIgnoreCode`; Libre.fm, protocol-identical, is assumed to
 * behave the same way; ListenBrainz's own docs describe listen submission as
 * idempotent-safe to retry).
 */
export function wireScrobbling(options: WireScrobblingOptions): ScrobblingHandle {
  const { queue, accountStore, createSessionClient, onScrobbled, onScrobbleFailed } = options;
  let consecutiveFailures = 0;

  const primaryService: ScrobblingServiceConnection | undefined =
    accountStore && createSessionClient
      ? {
          id: "lastfm",
          getClient: async () => {
            const active = await accountStore.getActiveAccount();
            return active ? createSessionClient(active.sessionKey) : undefined;
          },
        }
      : undefined;
  const services: readonly ScrobblingServiceConnection[] = [
    ...(primaryService ? [primaryService] : []),
    ...(options.additionalServices ?? []),
  ];

  /** Resolves every configured service's `getClient()` in parallel and returns only
   * the ones that are actually connected right now. */
  async function connectedServices(): Promise<readonly ConnectedService[]> {
    const resolved = await Promise.all(
      services.map(async (service) => ({ id: service.id, client: await service.getClient() })),
    );
    return resolved.filter((s): s is ConnectedService => s.client !== undefined);
  }

  function onScrobbleEligible(event: ScrobbleEligibleEvent): void {
    queue.enqueue({
      artist: event.track.artist,
      track: event.track.title,
      timestamp: event.startedAt,
      ...toOptionalTrackFields(event.track),
    });
  }

  async function onTrackChanged(event: TrackChangedEvent): Promise<void> {
    const connected = await connectedServices();
    if (connected.length === 0) {
      return;
    }
    const submission = {
      artist: event.track.artist,
      track: event.track.title,
      ...toOptionalTrackFields(event.track),
    };
    await Promise.all(
      connected.map(async ({ client }) => {
        try {
          await client.updateNowPlaying(submission);
        } catch {
          // Best-effort per service — see ScrobblingHandle.onTrackChanged's docstring
          // for why this isn't retried, surfaced via onScrobbleFailed (that callback
          // specifically tracks the persistent scrobble-queue drain, a different
          // failure mode with different stakes than a single transient now-playing
          // update), or allowed to stop the update from reaching other services.
        }
      }),
    );
  }

  async function drainOnce(): Promise<void> {
    const connected = await connectedServices();
    if (connected.length === 0) {
      return;
    }

    const batch = queue.dequeueBatch(DRAIN_BATCH_SIZE);
    if (batch.length === 0) {
      return;
    }

    const submissions = batch.map((item) => ({
      artist: item.artist,
      track: item.track,
      timestamp: item.timestamp,
      ...(item.album !== undefined ? { album: item.album } : {}),
      ...(item.albumArtist !== undefined ? { albumArtist: item.albumArtist } : {}),
      ...(item.durationSec !== undefined ? { durationSec: item.durationSec } : {}),
    }));

    const outcomes = await Promise.all(
      connected.map(async ({ id, client }) => {
        try {
          return { id, ok: true as const, result: await client.scrobble(submissions) };
        } catch (error) {
          return {
            id,
            ok: false as const,
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    // A batch that reached at least one connected service at all (even if every item
    // was individually ignored there) means connectivity to *that* service is fine —
    // any ongoing outage affecting it has recovered. Only when *every* connected
    // service's whole-batch call throws is this treated as a real outage for the
    // consecutive-failure counter below — one service blipping while the others are
    // reachable isn't the "can't scrobble at all" condition onScrobbleFailed exists to
    // report.
    const anyServiceReachable = outcomes.some((outcome) => outcome.ok);

    const accepted: ScrobbledTrack[] = [];
    batch.forEach((item, index) => {
      let acceptedByAny = false;
      const pendingReasons: string[] = [];

      for (const outcome of outcomes) {
        if (!outcome.ok) {
          // A thrown scrobble() call carries no per-item detail — every item in the
          // batch is retryable on this service, same convention LastfmClient.scrobble's
          // own whole-batch failure path already used before multi-service support.
          pendingReasons.push(`${outcome.id}: ${outcome.reason}`);
          continue;
        }
        const itemResult = outcome.result.results[index];
        if (!itemResult || itemResult.ignoredCode === 0) {
          acceptedByAny = true;
        } else if (itemResult.retryable) {
          pendingReasons.push(
            `${outcome.id}: ignored this scrobble (code ${itemResult.ignoredCode})`,
          );
        }
        // A non-retryable ignore from this particular service contributes nothing
        // further — that service is permanently done with this item either way.
      }

      if (pendingReasons.length > 0) {
        // Still retryable on at least one connected service — keep the whole item
        // queued; see this function's own docstring for why it's resubmitted to every
        // connected service next cycle rather than tracked per service.
        queue.recordFailure(item.id, { retryable: true, reason: pendingReasons.join("; ") });
      } else {
        queue.remove([item.id]);
        if (acceptedByAny) {
          accepted.push({ artist: item.artist, track: item.track });
        }
      }
    });

    if (anyServiceReachable) {
      consecutiveFailures = 0;
    } else {
      consecutiveFailures += 1;
      if (consecutiveFailures === FAILURE_NOTIFICATION_THRESHOLD) {
        const reason = outcomes
          .filter(
            (outcome): outcome is Extract<(typeof outcomes)[number], { ok: false }> => !outcome.ok,
          )
          .map((outcome) => `${outcome.id}: ${outcome.reason}`)
          .join("; ");
        onScrobbleFailed?.(reason);
      }
    }
    if (accepted.length > 0) {
      onScrobbled?.(accepted);
    }
  }

  const intervalHandle = setInterval(() => {
    void drainOnce();
  }, options.drainIntervalMs ?? DEFAULT_DRAIN_INTERVAL_MS);

  return {
    onScrobbleEligible,
    onTrackChanged,
    drainOnce,
    stop: () => {
      clearInterval(intervalHandle);
    },
  };
}

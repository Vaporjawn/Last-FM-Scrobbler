import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ScrobbleQueue } from "../../src/queue/scrobble-queue.js";
import type { PendingScrobble } from "../../src/queue/scrobble-queue.js";

const DAY_SEC = 24 * 60 * 60;

function makeScrobble(overrides: Partial<PendingScrobble> = {}): PendingScrobble {
  return {
    artist: "Test Artist",
    track: "Test Track",
    timestamp: 1_700_000_000,
    ...overrides,
  };
}

describe("ScrobbleQueue", () => {
  let queue: ScrobbleQueue;

  beforeEach(() => {
    queue = new ScrobbleQueue({ databasePath: ":memory:" });
  });

  afterEach(() => {
    queue.close();
  });

  it("starts empty", () => {
    expect(queue.count()).toBe(0);
  });

  it("enqueues a scrobble and reports it in the count", () => {
    queue.enqueue(makeScrobble());
    expect(queue.count()).toBe(1);
  });

  it("assigns each enqueued scrobble a unique id and zero retry count", () => {
    const queued = queue.enqueue(makeScrobble());
    expect(queued.id).toBeTypeOf("number");
    expect(queued.retryCount).toBe(0);
  });

  it("dequeues scrobbles ordered oldest-timestamp-first", () => {
    queue.enqueue(makeScrobble({ track: "Second", timestamp: 200 }));
    queue.enqueue(makeScrobble({ track: "First", timestamp: 100 }));
    queue.enqueue(makeScrobble({ track: "Third", timestamp: 300 }));

    const batch = queue.dequeueBatch(10);

    expect(batch.map((s) => s.track)).toEqual(["First", "Second", "Third"]);
  });

  it("respects the batch limit", () => {
    for (let i = 0; i < 5; i += 1) {
      queue.enqueue(makeScrobble({ timestamp: i }));
    }

    expect(queue.dequeueBatch(2)).toHaveLength(2);
  });

  it("preserves all scrobble fields through enqueue and dequeue", () => {
    queue.enqueue(
      makeScrobble({
        artist: "Artist",
        track: "Track",
        album: "Album",
        albumArtist: "Album Artist",
        durationSec: 245,
      }),
    );

    const [scrobble] = queue.dequeueBatch(1);

    expect(scrobble).toMatchObject({
      artist: "Artist",
      track: "Track",
      album: "Album",
      albumArtist: "Album Artist",
      durationSec: 245,
    });
  });

  it("removes scrobbles by id so they no longer appear in the queue", () => {
    const first = queue.enqueue(makeScrobble({ timestamp: 100 }));
    queue.enqueue(makeScrobble({ timestamp: 200 }));

    queue.remove([first.id]);

    expect(queue.count()).toBe(1);
    expect(queue.dequeueBatch(10)[0]?.id).not.toBe(first.id);
  });

  it("keeps a retryable failure in the queue and increments its retry count", () => {
    const queued = queue.enqueue(makeScrobble());

    queue.recordFailure(queued.id, { retryable: true, reason: "network timeout" });

    const [scrobble] = queue.dequeueBatch(1);
    expect(queue.count()).toBe(1);
    expect(scrobble?.retryCount).toBe(1);
    expect(scrobble?.lastError).toBe("network timeout");
  });

  it("drops a non-retryable failure from the queue entirely", () => {
    const queued = queue.enqueue(makeScrobble());

    queue.recordFailure(queued.id, {
      retryable: false,
      reason: "timestamp too far in the future",
    });

    expect(queue.count()).toBe(0);
  });

  it("evicts scrobbles older than the configured max age", () => {
    const now = 1_700_000_000;
    queue = new ScrobbleQueue({ databasePath: ":memory:", maxAgeDays: 14 });
    queue.enqueue(makeScrobble({ track: "Stale", timestamp: now - 15 * DAY_SEC }));
    queue.enqueue(makeScrobble({ track: "Fresh", timestamp: now - 1 * DAY_SEC }));

    const evicted = queue.evictStale(now);

    expect(evicted).toBe(1);
    expect(queue.count()).toBe(1);
    expect(queue.dequeueBatch(10)[0]?.track).toBe("Fresh");
  });

  it("does not evict a scrobble exactly at the max age boundary", () => {
    const now = 1_700_000_000;
    queue = new ScrobbleQueue({ databasePath: ":memory:", maxAgeDays: 14 });
    queue.enqueue(makeScrobble({ timestamp: now - 14 * DAY_SEC }));

    const evicted = queue.evictStale(now);

    expect(evicted).toBe(0);
    expect(queue.count()).toBe(1);
  });

  it("evicts the oldest rows first when over the configured max row count", () => {
    queue = new ScrobbleQueue({ databasePath: ":memory:", maxRows: 3 });
    queue.enqueue(makeScrobble({ track: "Oldest", timestamp: 100 }));
    queue.enqueue(makeScrobble({ track: "Middle", timestamp: 200 }));
    queue.enqueue(makeScrobble({ track: "Newer", timestamp: 300 }));
    queue.enqueue(makeScrobble({ track: "Newest", timestamp: 400 }));

    const evicted = queue.evictOverflow();

    expect(evicted).toBe(1);
    expect(queue.count()).toBe(3);
    expect(queue.dequeueBatch(10).map((s) => s.track)).toEqual(["Middle", "Newer", "Newest"]);
  });

  it("does nothing when under the max row count", () => {
    queue = new ScrobbleQueue({ databasePath: ":memory:", maxRows: 10 });
    queue.enqueue(makeScrobble());

    expect(queue.evictOverflow()).toBe(0);
    expect(queue.count()).toBe(1);
  });
});

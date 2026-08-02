import { describe, expect, it, vi } from "vitest";
import { AccountStore, ScrobbleQueue, type SecretStorage } from "@lastfm-scrobbler/core";
import type { TrackInfo } from "@lastfm-scrobbler/shared-types";
import { wireScrobbling } from "../../../src/main/scrobbling/wire-scrobbling.js";

function inMemoryStorage(): SecretStorage {
  const data = new Map<string, string>();
  return {
    get: (key) => Promise.resolve(data.get(key)),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
    delete: (key) => {
      data.delete(key);
      return Promise.resolve();
    },
    list: () => Promise.resolve([...data.keys()]),
  };
}

const TRACK: TrackInfo = {
  title: "Weights",
  artist: "Everything Everything",
  album: "Man Alive",
  durationSec: 340,
  sourceApp: "com.apple.Music",
  isStream: false,
};

describe("wireScrobbling", () => {
  it("onScrobbleEligible enqueues the track for later submission", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const accountStore = new AccountStore(inMemoryStorage());
    const { onScrobbleEligible, stop } = wireScrobbling({
      queue,
      accountStore,
      createSessionClient: vi.fn(),
    });

    onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

    expect(queue.count()).toBe(1);
    const [pending] = queue.dequeueBatch(1);
    expect(pending).toMatchObject({
      artist: "Everything Everything",
      track: "Weights",
      album: "Man Alive",
      timestamp: 1_700_000_000,
      durationSec: 340,
    });

    stop();
    queue.close();
  });

  it("drainOnce does nothing when no account is active (nothing enqueued stays enqueued)", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const accountStore = new AccountStore(inMemoryStorage());
    const createSessionClient = vi.fn();
    const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
      queue,
      accountStore,
      createSessionClient,
    });
    onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

    await drainOnce();

    expect(createSessionClient).not.toHaveBeenCalled();
    expect(queue.count()).toBe(1);

    stop();
    queue.close();
  });

  it("drainOnce submits queued scrobbles and removes accepted ones", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
    const scrobble = vi.fn().mockResolvedValue({
      accepted: 1,
      ignored: 0,
      results: [{ track: "Weights", ignoredCode: 0, retryable: false }],
    });
    const createSessionClient = vi.fn().mockReturnValue({ scrobble });
    const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
      queue,
      accountStore,
      createSessionClient,
    });
    onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

    await drainOnce();

    expect(createSessionClient).toHaveBeenCalledWith("sk-123");
    expect(scrobble).toHaveBeenCalledWith([
      expect.objectContaining({
        artist: "Everything Everything",
        track: "Weights",
        timestamp: 1_700_000_000,
      }),
    ]);
    expect(queue.count()).toBe(0);

    stop();
    queue.close();
  });

  it("drainOnce calls onScrobbled with the accepted tracks", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
    const scrobble = vi.fn().mockResolvedValue({
      accepted: 1,
      ignored: 0,
      results: [{ track: "Weights", ignoredCode: 0, retryable: false }],
    });
    const createSessionClient = vi.fn().mockReturnValue({ scrobble });
    const onScrobbled = vi.fn();
    const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
      queue,
      accountStore,
      createSessionClient,
      onScrobbled,
    });
    onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

    await drainOnce();

    expect(onScrobbled).toHaveBeenCalledWith([{ artist: "Everything Everything", track: "Weights" }]);

    stop();
    queue.close();
  });

  it("drainOnce does not call onScrobbled when every item in the batch is ignored", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
    const scrobble = vi.fn().mockResolvedValue({
      accepted: 0,
      ignored: 1,
      results: [{ track: "Weights", ignoredCode: 1, retryable: false }],
    });
    const createSessionClient = vi.fn().mockReturnValue({ scrobble });
    const onScrobbled = vi.fn();
    const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
      queue,
      accountStore,
      createSessionClient,
      onScrobbled,
    });
    onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

    await drainOnce();

    expect(onScrobbled).not.toHaveBeenCalled();

    stop();
    queue.close();
  });

  it("drainOnce calls onScrobbleFailed only once submission has failed 3 consecutive cycles, not every retry", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
    const scrobble = vi.fn().mockRejectedValue(new Error("network error"));
    const createSessionClient = vi.fn().mockReturnValue({ scrobble });
    const onScrobbleFailed = vi.fn();
    const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
      queue,
      accountStore,
      createSessionClient,
      onScrobbleFailed,
    });
    onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

    await drainOnce();
    expect(onScrobbleFailed).not.toHaveBeenCalled();
    await drainOnce();
    expect(onScrobbleFailed).not.toHaveBeenCalled();
    await drainOnce();
    expect(onScrobbleFailed).toHaveBeenCalledTimes(1);
    expect(onScrobbleFailed).toHaveBeenCalledWith(expect.stringContaining("network error"));
    // A 4th consecutive failure doesn't fire it again — only the threshold crossing does.
    await drainOnce();
    expect(onScrobbleFailed).toHaveBeenCalledTimes(1);

    stop();
    queue.close();
  });

  it("a successful drain resets the consecutive-failure count, so a later outage notifies again", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
    const scrobble = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockRejectedValueOnce(new Error("network error"))
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({
        accepted: 1,
        ignored: 0,
        results: [{ track: "Weights", ignoredCode: 0, retryable: false }],
      })
      .mockRejectedValue(new Error("network error"));
    const createSessionClient = vi.fn().mockReturnValue({ scrobble });
    const onScrobbleFailed = vi.fn();
    const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
      queue,
      accountStore,
      createSessionClient,
      onScrobbleFailed,
    });

    // 3 failures — notifies once.
    onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });
    await drainOnce();
    await drainOnce();
    await drainOnce();
    expect(onScrobbleFailed).toHaveBeenCalledTimes(1);

    // A success in between resets the counter...
    onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_001 });
    await drainOnce();

    // ...so it takes another full 3 consecutive failures to notify again.
    onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_002 });
    await drainOnce();
    await drainOnce();
    expect(onScrobbleFailed).toHaveBeenCalledTimes(1);
    await drainOnce();
    expect(onScrobbleFailed).toHaveBeenCalledTimes(2);

    stop();
    queue.close();
  });

  it("drainOnce keeps a scrobble queued (with recorded failure) when Last.fm reports a retryable ignore", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
    const scrobble = vi.fn().mockResolvedValue({
      accepted: 0,
      ignored: 1,
      results: [{ track: "Weights", ignoredCode: 5, retryable: true }], // 5 = daily limit exceeded
    });
    const createSessionClient = vi.fn().mockReturnValue({ scrobble });
    const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
      queue,
      accountStore,
      createSessionClient,
    });
    onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

    await drainOnce();

    expect(queue.count()).toBe(1);
    const [pending] = queue.dequeueBatch(1);
    expect(pending?.retryCount).toBe(1);

    stop();
    queue.close();
  });

  it("drainOnce drops a scrobble outright when Last.fm reports a non-retryable ignore", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
    const scrobble = vi.fn().mockResolvedValue({
      accepted: 0,
      ignored: 1,
      results: [{ track: "Weights", ignoredCode: 1, retryable: false }], // 1 = artist ignored
    });
    const createSessionClient = vi.fn().mockReturnValue({ scrobble });
    const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
      queue,
      accountStore,
      createSessionClient,
    });
    onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

    await drainOnce();

    expect(queue.count()).toBe(0);

    stop();
    queue.close();
  });

  it("drainOnce records a retryable failure for every queued item when the whole submission throws", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
    const scrobble = vi.fn().mockRejectedValue(new Error("network error"));
    const createSessionClient = vi.fn().mockReturnValue({ scrobble });
    const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
      queue,
      accountStore,
      createSessionClient,
    });
    onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

    await drainOnce();

    expect(queue.count()).toBe(1);
    const [pending] = queue.dequeueBatch(1);
    expect(pending?.retryCount).toBe(1);
    expect(pending?.lastError).toContain("network error");

    stop();
    queue.close();
  });

  it("stop() clears the drain interval", () => {
    vi.useFakeTimers();
    try {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage());
      const createSessionClient = vi.fn();
      const { stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient,
        drainIntervalMs: 1000,
      });

      stop();
      vi.advanceTimersByTime(10_000);

      expect(createSessionClient).not.toHaveBeenCalled();
      queue.close();
    } finally {
      vi.useRealTimers();
    }
  });
});

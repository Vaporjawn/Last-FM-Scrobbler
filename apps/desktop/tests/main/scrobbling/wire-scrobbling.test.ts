import { describe, expect, it, vi } from "vitest";
import {
  AccountStore,
  NetworkStatusMonitor,
  ScrobbleQueue,
  type ScrobblingClient,
  type SecretStorage,
} from "@lastfm-scrobbler/core";
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

    expect(onScrobbled).toHaveBeenCalledWith([
      { artist: "Everything Everything", track: "Weights" },
    ]);

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

  it("drainOnce routes a rejected getClient() through the same consecutive-failure accounting as a network outage, instead of an unhandled rejection", async () => {
    // Regression test: connectedServices() awaited accountStore.getActiveAccount()
    // with no try/catch, and drainOnce is always invoked via a bare `void drainOnce()`
    // on the interval with no `.catch()` anywhere — a rejection here (e.g.
    // ElectronSecretStorage.get() throwing because safeStorage.decryptString() fails:
    // revoked Keychain access, a corrupted secrets file, the profile copied to
    // another machine) used to escape as an unhandled promise rejection every single
    // cycle, forever, completely bypassing this exact consecutiveFailures/
    // onScrobbleFailed accounting.
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const failingStorage: SecretStorage = {
      get: () => Promise.reject(new Error("Keychain access denied")),
      set: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      list: () => Promise.resolve([]),
    };
    const accountStore = new AccountStore(failingStorage);
    const onScrobbleFailed = vi.fn();
    const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
      queue,
      accountStore,
      createSessionClient: vi.fn(),
      onScrobbleFailed,
    });
    onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

    await expect(drainOnce()).resolves.toBeUndefined();
    expect(onScrobbleFailed).not.toHaveBeenCalled();
    await expect(drainOnce()).resolves.toBeUndefined();
    await expect(drainOnce()).resolves.toBeUndefined();

    expect(onScrobbleFailed).toHaveBeenCalledTimes(1);
    expect(onScrobbleFailed).toHaveBeenCalledWith(
      expect.stringContaining("Keychain access denied"),
    );
    // The item stays queued — nothing was actually submitted or dropped.
    expect(queue.count()).toBe(1);

    stop();
    queue.close();
  });

  it("onTrackChanged never throws when getClient() rejects", async () => {
    // Regression test, same underlying bug as drainOnce's above, for the other bare
    // `void`-invoked call site (main/index.ts's `void scrobbling.onTrackChanged(event)`).
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const failingStorage: SecretStorage = {
      get: () => Promise.reject(new Error("Keychain access denied")),
      set: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      list: () => Promise.resolve([]),
    };
    const accountStore = new AccountStore(failingStorage);
    const { onTrackChanged, stop } = wireScrobbling({
      queue,
      accountStore,
      createSessionClient: vi.fn(),
    });

    await expect(
      onTrackChanged({ track: TRACK, startedAt: 1_700_000_000 }),
    ).resolves.toBeUndefined();

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

  it("onTrackChanged calls updateNowPlaying for the active account", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
    const updateNowPlaying = vi.fn().mockResolvedValue(undefined);
    const createSessionClient = vi.fn().mockReturnValue({ scrobble: vi.fn(), updateNowPlaying });
    const { onTrackChanged, stop } = wireScrobbling({ queue, accountStore, createSessionClient });

    await onTrackChanged({ track: TRACK, startedAt: 1_700_000_000 });

    expect(createSessionClient).toHaveBeenCalledWith("sk-123");
    expect(updateNowPlaying).toHaveBeenCalledWith(
      expect.objectContaining({
        artist: "Everything Everything",
        track: "Weights",
        album: "Man Alive",
        durationSec: 340,
      }),
    );

    stop();
    queue.close();
  });

  it("onTrackChanged does nothing when no account is active", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const accountStore = new AccountStore(inMemoryStorage());
    const createSessionClient = vi.fn();
    const { onTrackChanged, stop } = wireScrobbling({ queue, accountStore, createSessionClient });

    await onTrackChanged({ track: TRACK, startedAt: 1_700_000_000 });

    expect(createSessionClient).not.toHaveBeenCalled();

    stop();
    queue.close();
  });

  it("onTrackChanged never throws, even when updateNowPlaying itself rejects", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
    const updateNowPlaying = vi.fn().mockRejectedValue(new Error("network error"));
    const createSessionClient = vi.fn().mockReturnValue({ scrobble: vi.fn(), updateNowPlaying });
    const { onTrackChanged, stop } = wireScrobbling({ queue, accountStore, createSessionClient });

    await expect(
      onTrackChanged({ track: TRACK, startedAt: 1_700_000_000 }),
    ).resolves.toBeUndefined();

    stop();
    queue.close();
  });

  describe("multi-service (additionalServices)", () => {
    function connection(
      id: string,
      client: { scrobble: ReturnType<typeof vi.fn>; updateNowPlaying?: ReturnType<typeof vi.fn> },
    ) {
      return { id, getClient: vi.fn().mockResolvedValue(client) };
    }

    it("submits a drained batch to Last.fm and every additional connected service", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage());
      await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
      const lastfmScrobble = vi.fn().mockResolvedValue({
        accepted: 1,
        ignored: 0,
        results: [{ track: "Weights", ignoredCode: 0, retryable: false }],
      });
      const createSessionClient = vi.fn().mockReturnValue({ scrobble: lastfmScrobble });
      const librefmScrobble = vi.fn().mockResolvedValue({
        accepted: 1,
        ignored: 0,
        results: [{ track: "Weights", ignoredCode: 0, retryable: false }],
      });
      const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient,
        additionalServices: [connection("librefm", { scrobble: librefmScrobble })],
      });
      onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

      await drainOnce();

      expect(lastfmScrobble).toHaveBeenCalledTimes(1);
      expect(librefmScrobble).toHaveBeenCalledTimes(1);
      expect(queue.count()).toBe(0);

      stop();
      queue.close();
    });

    it("keeps a scrobble queued when it's retryable on only one of several connected services", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage());
      await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
      const lastfmScrobble = vi.fn().mockResolvedValue({
        accepted: 1,
        ignored: 0,
        results: [{ track: "Weights", ignoredCode: 0, retryable: false }],
      });
      const createSessionClient = vi.fn().mockReturnValue({ scrobble: lastfmScrobble });
      const librefmScrobble = vi.fn().mockRejectedValue(new Error("librefm network error"));
      const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient,
        additionalServices: [connection("librefm", { scrobble: librefmScrobble })],
      });
      onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

      await drainOnce();

      // Still queued — Libre.fm hasn't confirmed it yet, even though Last.fm has.
      expect(queue.count()).toBe(1);
      const [pending] = queue.dequeueBatch(1);
      expect(pending?.lastError).toContain("librefm network error");

      // Next cycle resubmits to *both* services again, including the one that
      // already succeeded — the documented duplicate-tolerance tradeoff.
      await drainOnce();
      expect(lastfmScrobble).toHaveBeenCalledTimes(2);
      expect(librefmScrobble).toHaveBeenCalledTimes(2);

      stop();
      queue.close();
    });

    it("removes a scrobble once every connected service has accepted or permanently rejected it", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage());
      await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
      const lastfmScrobble = vi.fn().mockResolvedValue({
        accepted: 0,
        ignored: 1,
        results: [{ track: "Weights", ignoredCode: 1, retryable: false }], // permanently ignored
      });
      const createSessionClient = vi.fn().mockReturnValue({ scrobble: lastfmScrobble });
      const librefmScrobble = vi.fn().mockResolvedValue({
        accepted: 1,
        ignored: 0,
        results: [{ track: "Weights", ignoredCode: 0, retryable: false }],
      });
      const onScrobbled = vi.fn();
      const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient,
        additionalServices: [connection("librefm", { scrobble: librefmScrobble })],
        onScrobbled,
      });
      onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

      await drainOnce();

      expect(queue.count()).toBe(0);
      // Accepted by Libre.fm even though Last.fm permanently ignored it — still
      // reported once as an accepted scrobble.
      expect(onScrobbled).toHaveBeenCalledWith([
        { artist: "Everything Everything", track: "Weights" },
      ]);

      stop();
      queue.close();
    });

    it("works with only an additional service connected and no Last.fm account active", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage()); // no active account
      const createSessionClient = vi.fn();
      const listenbrainzScrobble = vi.fn().mockResolvedValue({
        accepted: 1,
        ignored: 0,
        results: [{ track: "Weights", ignoredCode: 0, retryable: false }],
      });
      const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient,
        additionalServices: [connection("listenbrainz", { scrobble: listenbrainzScrobble })],
      });
      onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

      await drainOnce();

      expect(createSessionClient).not.toHaveBeenCalled();
      expect(listenbrainzScrobble).toHaveBeenCalledTimes(1);
      expect(queue.count()).toBe(0);

      stop();
      queue.close();
    });

    it("works with no primary accountStore/createSessionClient supplied at all", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const listenbrainzScrobble = vi.fn().mockResolvedValue({
        accepted: 1,
        ignored: 0,
        results: [{ track: "Weights", ignoredCode: 0, retryable: false }],
      });
      const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
        queue,
        additionalServices: [connection("listenbrainz", { scrobble: listenbrainzScrobble })],
      });
      onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

      await drainOnce();

      expect(listenbrainzScrobble).toHaveBeenCalledTimes(1);
      expect(queue.count()).toBe(0);

      stop();
      queue.close();
    });

    it("onScrobbleFailed only fires once every connected service fails, not just one of them", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage());
      await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
      const lastfmScrobble = vi.fn().mockResolvedValue({
        accepted: 1,
        ignored: 0,
        results: [{ track: "Weights", ignoredCode: 0, retryable: false }],
      });
      const createSessionClient = vi.fn().mockReturnValue({ scrobble: lastfmScrobble });
      const librefmScrobble = vi.fn().mockRejectedValue(new Error("librefm down"));
      const onScrobbleFailed = vi.fn();
      const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient,
        additionalServices: [connection("librefm", { scrobble: librefmScrobble })],
        onScrobbleFailed,
      });

      // 3 consecutive cycles where Libre.fm fails but Last.fm succeeds — Last.fm being
      // reachable means this isn't a "can't scrobble at all" outage.
      onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });
      await drainOnce();
      onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_001 });
      await drainOnce();
      onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_002 });
      await drainOnce();

      expect(onScrobbleFailed).not.toHaveBeenCalled();

      stop();
      queue.close();
    });

    it("onTrackChanged pushes now-playing to every connected service", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage());
      await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
      const lastfmUpdateNowPlaying = vi.fn().mockResolvedValue(undefined);
      const createSessionClient = vi
        .fn()
        .mockReturnValue({ scrobble: vi.fn(), updateNowPlaying: lastfmUpdateNowPlaying });
      const librefmUpdateNowPlaying = vi.fn().mockRejectedValue(new Error("librefm error"));
      const { onTrackChanged, stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient,
        additionalServices: [
          connection("librefm", { scrobble: vi.fn(), updateNowPlaying: librefmUpdateNowPlaying }),
        ],
      });

      await expect(
        onTrackChanged({ track: TRACK, startedAt: 1_700_000_000 }),
      ).resolves.toBeUndefined();

      expect(lastfmUpdateNowPlaying).toHaveBeenCalledTimes(1);
      expect(librefmUpdateNowPlaying).toHaveBeenCalledTimes(1);

      stop();
      queue.close();
    });
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

  it("reports success to networkStatus when a drain batch reaches a connected service", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const accountStore = new AccountStore(inMemoryStorage());
    await accountStore.addAccount({ username: "alice", sessionKey: "key" });
    await accountStore.setActiveAccount("alice");
    const networkStatus = new NetworkStatusMonitor({ queue });
    const client: ScrobblingClient = {
      updateNowPlaying: vi.fn(),
      scrobble: vi.fn().mockResolvedValue({ results: [{ ignoredCode: 0 }] }),
    };
    const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
      queue,
      accountStore,
      createSessionClient: () => client,
      networkStatus,
    });
    onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

    await drainOnce();

    expect(networkStatus.getStatus().online).toBe(true);
    stop();
    queue.close();
  });

  it("reports a classified network failure to networkStatus when connectedServices() rejects", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const failingAccountStore = {
      getActiveAccount: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("keychain unavailable"), { code: "ECONNREFUSED" }),
        ),
    } as unknown as AccountStore;
    const networkStatus = new NetworkStatusMonitor({ queue });
    const { drainOnce, stop } = wireScrobbling({
      queue,
      accountStore: failingAccountStore,
      createSessionClient: vi.fn(),
      networkStatus,
    });

    await drainOnce();

    expect(networkStatus.getStatus().online).toBe(false);
    stop();
    queue.close();
  });

  describe("optional fields and non-Error failures", () => {
    const ACCEPTED_ONE = {
      accepted: 1,
      ignored: 0,
      results: [{ track: "Untitled", ignoredCode: 0, retryable: false }],
    };

    it("submits only the optional fields a track actually has", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage());
      await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
      const scrobble = vi.fn().mockResolvedValue(ACCEPTED_ONE);
      const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient: () => ({ scrobble }) as never,
      });
      const { album: _album, durationSec: _duration, ...sparse } = TRACK;

      onScrobbleEligible({
        track: { ...sparse, title: "Untitled", albumArtist: "Various Artists" },
        startedAt: 1_700_000_000,
      });
      await drainOnce();

      expect(scrobble).toHaveBeenCalledWith([
        {
          artist: "Everything Everything",
          track: "Untitled",
          timestamp: 1_700_000_000,
          albumArtist: "Various Artists",
        },
      ]);
      stop();
      queue.close();
    });

    it("does nothing when a connected account has nothing queued", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage());
      await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
      const scrobble = vi.fn();
      const { drainOnce, stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient: () => ({ scrobble }) as never,
      });

      await drainOnce();

      expect(scrobble).not.toHaveBeenCalled();
      stop();
      queue.close();
    });

    it("describes a non-Error failure to look up connected accounts by its string form", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const failingStorage: SecretStorage = {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        get: () => Promise.reject("keychain locked"),
        set: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        list: () => Promise.resolve([]),
      };
      const onScrobbleFailed = vi.fn();
      const { drainOnce, stop } = wireScrobbling({
        queue,
        accountStore: new AccountStore(failingStorage),
        createSessionClient: vi.fn(),
        onScrobbleFailed,
      });

      await drainOnce();
      await drainOnce();
      await drainOnce();

      expect(onScrobbleFailed).toHaveBeenCalledWith(
        "Unable to check connected accounts: keychain locked",
      );
      stop();
      queue.close();
    });

    it("describes a non-Error submission failure by its string form", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage());
      await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });

      const scrobble = vi.fn().mockRejectedValue("socket hang up");
      const onScrobbleFailed = vi.fn();
      const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient: () => ({ scrobble }) as never,
        onScrobbleFailed,
      });
      onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

      await drainOnce();
      await drainOnce();
      await drainOnce();

      expect(onScrobbleFailed).toHaveBeenCalledWith(expect.stringContaining("socket hang up"));
      stop();
      queue.close();
    });

    it("drains on its own schedule", async () => {
      vi.useFakeTimers();
      try {
        const queue = new ScrobbleQueue({ databasePath: ":memory:" });
        const accountStore = new AccountStore(inMemoryStorage());
        await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
        const scrobble = vi.fn().mockResolvedValue({
          accepted: 1,
          ignored: 0,
          results: [{ track: "Weights", ignoredCode: 0, retryable: false }],
        });
        const { onScrobbleEligible, stop } = wireScrobbling({
          queue,
          accountStore,
          createSessionClient: () => ({ scrobble }) as never,
          drainIntervalMs: 1000,
        });
        onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

        await vi.advanceTimersByTimeAsync(1000);

        expect(scrobble).toHaveBeenCalledTimes(1);
        stop();
        queue.close();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("overlapping work", () => {
    function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    }

    const ACCEPTED = {
      accepted: 1,
      ignored: 0,
      results: [{ track: "Weights", ignoredCode: 0, retryable: false }],
    };

    it("submits a batch once even when a second drain starts while the first is still in flight", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage());
      await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
      const reply = deferred<typeof ACCEPTED>();
      const scrobble = vi.fn().mockReturnValue(reply.promise);
      const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient: () => ({ scrobble }) as never,
      });
      onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

      const first = drainOnce();
      const second = drainOnce();
      await vi.waitFor(() => {
        expect(scrobble).toHaveBeenCalledTimes(1);
      });
      reply.resolve(ACCEPTED);
      await Promise.all([first, second]);

      expect(scrobble).toHaveBeenCalledTimes(1);
      expect(queue.count()).toBe(0);
      stop();
      queue.close();
    });

    it("can drain again once the previous drain has finished", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage());
      await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
      const scrobble = vi.fn().mockResolvedValue(ACCEPTED);
      const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient: () => ({ scrobble }) as never,
      });
      onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });
      await drainOnce();
      onScrobbleEligible({ track: { ...TRACK, title: "Next" }, startedAt: 1_700_000_500 });

      await drainOnce();

      expect(scrobble).toHaveBeenCalledTimes(2);
      stop();
      queue.close();
    });

    it("recovers from a drain that failed outright so later drains still run", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage());
      await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
      const scrobble = vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(ACCEPTED);
      const { onScrobbleEligible, drainOnce, stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient: () => ({ scrobble }) as never,
      });
      onScrobbleEligible({ track: TRACK, startedAt: 1_700_000_000 });

      await drainOnce();
      await drainOnce();

      expect(queue.count()).toBe(0);
      stop();
      queue.close();
    });

    it("sends now-playing updates one at a time, in order, and skips superseded ones", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage());
      await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
      const firstReply = deferred<undefined>();
      const updateNowPlaying = vi
        .fn()
        .mockReturnValueOnce(firstReply.promise)
        .mockResolvedValue(undefined);
      const { onTrackChanged, stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient: () => ({ scrobble: vi.fn(), updateNowPlaying }),
      });
      const event = (title: string) => ({ track: { ...TRACK, title }, startedAt: 1 });

      const first = onTrackChanged(event("A"));
      await vi.waitFor(() => {
        expect(updateNowPlaying).toHaveBeenCalledTimes(1);
      });
      const second = onTrackChanged(event("B"));
      const third = onTrackChanged(event("C"));
      await Promise.all([second, third]);
      expect(updateNowPlaying).toHaveBeenCalledTimes(1);

      firstReply.resolve(undefined);
      await first;

      expect(
        updateNowPlaying.mock.calls.map((call) => (call[0] as { track: string }).track),
      ).toEqual(["A", "C"]);
      stop();
      queue.close();
    });

    it("logs, instead of leaving an unhandled rejection, when a scheduled drain throws", async () => {
      vi.useFakeTimers();
      try {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const queue = new ScrobbleQueue({ databasePath: ":memory:" });
        const accountStore = new AccountStore(inMemoryStorage());
        await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
        const failure = new Error("database is closed");
        vi.spyOn(queue, "dequeueBatch").mockImplementation(() => {
          throw failure;
        });
        const { stop } = wireScrobbling({
          queue,
          accountStore,
          createSessionClient: () => ({ scrobble: vi.fn() }) as never,
          drainIntervalMs: 1000,
        });

        await vi.advanceTimersByTimeAsync(1000);

        expect(errorSpy).toHaveBeenCalledWith("scrobbling: drain failed:", failure);
        stop();
        queue.close();
        errorSpy.mockRestore();
      } finally {
        vi.useRealTimers();
      }
    });

    it("sends the next now-playing update after the previous one has finished", async () => {
      const queue = new ScrobbleQueue({ databasePath: ":memory:" });
      const accountStore = new AccountStore(inMemoryStorage());
      await accountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
      const updateNowPlaying = vi.fn().mockResolvedValue(undefined);
      const { onTrackChanged, stop } = wireScrobbling({
        queue,
        accountStore,
        createSessionClient: () => ({ scrobble: vi.fn(), updateNowPlaying }),
      });

      await onTrackChanged({ track: TRACK, startedAt: 1 });
      await onTrackChanged({ track: { ...TRACK, title: "Next" }, startedAt: 2 });

      expect(updateNowPlaying).toHaveBeenCalledTimes(2);
      stop();
      queue.close();
    });
  });
});

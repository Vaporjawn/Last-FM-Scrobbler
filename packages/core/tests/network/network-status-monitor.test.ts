import { describe, expect, it, vi } from "vitest";
import { ScrobbleQueue } from "../../src/queue/scrobble-queue.js";
import { NetworkStatusMonitor } from "../../src/network/network-status-monitor.js";

class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

function networkError(): Error {
  const error = new Error("connect failed");
  (error as unknown as { code: string }).code = "ECONNREFUSED";
  return error;
}

describe("NetworkStatusMonitor", () => {
  it("starts with online: null (never reported) and pendingCount reflecting the queue", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    queue.enqueue({ artist: "A", track: "B", timestamp: 1_700_000_000 });
    const monitor = new NetworkStatusMonitor({ queue });

    expect(monitor.getStatus()).toEqual({ online: null, pendingCount: 1, lastSyncedAt: null });
    queue.close();
  });

  it("reportSuccess sets online: true and lastSyncedAt", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const monitor = new NetworkStatusMonitor({ queue });

    monitor.reportSuccess();

    const status = monitor.getStatus();
    expect(status.online).toBe(true);
    expect(status.lastSyncedAt).not.toBeNull();
    queue.close();
  });

  it("reportFailure with a classified network error sets online: false", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const monitor = new NetworkStatusMonitor({ queue });
    monitor.reportSuccess();

    monitor.reportFailure(networkError());

    expect(monitor.getStatus().online).toBe(false);
    queue.close();
  });

  it("reportFailure with a non-network (application-level) error leaves online unchanged", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const monitor = new NetworkStatusMonitor({ queue });
    monitor.reportSuccess();

    monitor.reportFailure(new ApiError(6, "not found"));

    expect(monitor.getStatus().online).toBe(true);
    queue.close();
  });

  it("reportQueueChanged re-reads the queue's current count", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const monitor = new NetworkStatusMonitor({ queue });
    expect(monitor.getStatus().pendingCount).toBe(0);

    queue.enqueue({ artist: "A", track: "B", timestamp: 1_700_000_000 });
    monitor.reportQueueChanged();

    expect(monitor.getStatus().pendingCount).toBe(1);
    queue.close();
  });

  it("subscribe receives every reported change and can unsubscribe", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const monitor = new NetworkStatusMonitor({ queue });
    const listener = vi.fn();
    const unsubscribe = monitor.subscribe(listener);

    monitor.reportSuccess();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(monitor.getStatus());

    unsubscribe();
    monitor.reportSuccess();
    expect(listener).toHaveBeenCalledTimes(1);
    queue.close();
  });

  it("reportFailure with a non-network error does not notify subscribers", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const monitor = new NetworkStatusMonitor({ queue });
    const listener = vi.fn();
    monitor.subscribe(listener);

    monitor.reportFailure(new ApiError(6, "not found"));

    expect(listener).not.toHaveBeenCalled();
    queue.close();
  });
});

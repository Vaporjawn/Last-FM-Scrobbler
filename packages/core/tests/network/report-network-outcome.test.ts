import { describe, expect, it } from "vitest";
import { ScrobbleQueue } from "../../src/queue/scrobble-queue.js";
import { NetworkStatusMonitor } from "../../src/network/network-status-monitor.js";
import { reportNetworkOutcome } from "../../src/network/report-network-outcome.js";

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

describe("reportNetworkOutcome", () => {
  it("resolves with the original value and reports success", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const monitor = new NetworkStatusMonitor({ queue });

    const result = await reportNetworkOutcome(monitor, Promise.resolve("ok"));

    expect(result).toBe("ok");
    expect(monitor.getStatus().online).toBe(true);
    queue.close();
  });

  it("rewrites a classified network failure to the friendly message and reports it", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const monitor = new NetworkStatusMonitor({ queue });

    await expect(reportNetworkOutcome(monitor, Promise.reject(networkError()))).rejects.toThrow(
      "Can't reach Last.fm — check your internet connection.",
    );
    expect(monitor.getStatus().online).toBe(false);
    queue.close();
  });

  it("rethrows a non-network (application-level) error unchanged and does not affect online", async () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const monitor = new NetworkStatusMonitor({ queue });
    monitor.reportSuccess();
    const original = new ApiError(6, "The artist you supplied could not be found");

    await expect(reportNetworkOutcome(monitor, Promise.reject(original))).rejects.toBe(original);
    expect(monitor.getStatus().online).toBe(true);
    queue.close();
  });

  it("is a transparent pass-through when monitor is undefined", async () => {
    await expect(reportNetworkOutcome(undefined, Promise.resolve(42))).resolves.toBe(42);
    const original = new Error("boom");
    await expect(reportNetworkOutcome(undefined, Promise.reject(original))).rejects.toBe(original);
  });
});

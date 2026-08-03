import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UpdateStatus } from "../../src/shared/update-status.js";
import type { UpdatesApi } from "../../src/shared/updates-api.js";
import { useUpdates } from "../../src/renderer/src/hooks/use-updates.js";

// See use-recent-tracks.test.ts's own note on why this codebase otherwise avoids
// dedicated hook test files — useUpdates gets one for the same reason
// use-now-playing.test.ts does: its pull-vs-push race handling needs precise control
// over promise-resolution ordering that's impractical to drive through a rendered
// page's DOM alone.

/** A promise plus its own externally-callable resolve/reject — for tests that need to
 * control exactly when getStatus() settles relative to a push event. */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function installFakeUpdatesApi(getStatus: UpdatesApi["getStatus"]): {
  emitStatusChanged: (status: UpdateStatus) => void;
  checkNow: ReturnType<typeof vi.fn>;
} {
  const listeners = new Set<(status: UpdateStatus) => void>();
  const checkNow = vi.fn().mockResolvedValue(undefined);
  const api: UpdatesApi = {
    getStatus,
    checkNow,
    onStatusChanged: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
  Object.defineProperty(window, "updates", { value: api, configurable: true });

  return {
    emitStatusChanged: (status) => {
      for (const listener of listeners) listener(status);
    },
    checkNow,
  };
}

describe("useUpdates", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "updates");
  });

  it("returns idle status when window.updates isn't present", () => {
    const { result } = renderHook(() => useUpdates());

    expect(result.current.status).toEqual({ phase: "idle" });
    expect(result.current.isChecking).toBe(false);
  });

  it("applies the pulled status once it resolves", async () => {
    installFakeUpdatesApi(vi.fn().mockResolvedValue({ phase: "not-available" }));

    const { result } = renderHook(() => useUpdates());

    await waitFor(() => {
      expect(result.current.status).toEqual({ phase: "not-available" });
    });
  });

  it("surfaces a rejected initial getStatus() via `error`, instead of only logging it", async () => {
    // Regression test: the initial getStatus() failure was only console.error'd,
    // never surfaced via this hook's own `error` state — unlike checkNow, which does
    // call setError on failure. A rejected initial call (e.g. a stale preload build
    // missing the method) left status at IDLE and error at undefined, indistinguishable
    // from "checked, up to date."
    installFakeUpdatesApi(vi.fn().mockRejectedValue(new Error("no such method")));

    const { result } = renderHook(() => useUpdates());

    await waitFor(() => {
      expect(result.current.error).toBe("no such method");
    });
    expect(result.current.status).toEqual({ phase: "idle" });
  });

  it("does not let a stale pull response overwrite a status pushed before it resolves", async () => {
    // Regression test: a mount's getStatus() pull can be in flight when an
    // independent async check event (wireUpdates schedules one 10s after startup and
    // every 4h) pushes a real status change — if the pull's IPC response happens to
    // land after that push, it used to unconditionally overwrite the correct,
    // already-pushed status with the stale one it was carrying.
    const pull = deferred<UpdateStatus>();
    const { emitStatusChanged } = installFakeUpdatesApi(vi.fn().mockReturnValue(pull.promise));

    const { result } = renderHook(() => useUpdates());
    expect(result.current.status).toEqual({ phase: "idle" });

    // A real background check pushes "downloaded" before the pull (still carrying
    // the earlier "checking" status) resolves.
    act(() => {
      emitStatusChanged({ phase: "downloaded", version: "1.2.3" });
    });
    expect(result.current.status).toEqual({ phase: "downloaded", version: "1.2.3" });

    await act(async () => {
      pull.resolve({ phase: "checking" });
      await pull.promise;
    });

    // The stale pull must not have reverted the correct, newer pushed status.
    expect(result.current.status).toEqual({ phase: "downloaded", version: "1.2.3" });
  });

  it("still applies the pull when no push has arrived before it resolves", async () => {
    const pull = deferred<UpdateStatus>();
    installFakeUpdatesApi(vi.fn().mockReturnValue(pull.promise));

    const { result } = renderHook(() => useUpdates());

    await act(async () => {
      pull.resolve({ phase: "not-available" });
      await pull.promise;
    });

    expect(result.current.status).toEqual({ phase: "not-available" });
  });

  it("checkNow sets error on failure", async () => {
    const { checkNow } = installFakeUpdatesApi(vi.fn().mockResolvedValue({ phase: "idle" }));
    checkNow.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useUpdates());
    await waitFor(() => {
      expect(result.current.status).toEqual({ phase: "idle" });
    });

    await act(async () => {
      await result.current.checkNow();
    });

    expect(result.current.error).toBe("network error");
  });
});

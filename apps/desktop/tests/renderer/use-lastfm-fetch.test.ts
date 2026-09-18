import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NetworkStatus } from "@lastfm-scrobbler/core";
import type { NetworkStatusApi } from "../../src/shared/network-status-api.js";
import { useLastfmFetch } from "../../src/renderer/src/hooks/use-lastfm-fetch.js";

/** Matches `use-updates.test.ts`'s own `installFakeUpdatesApi` convention — bypasses
 * `window.networkStatus`'s `readonly` typing via `Object.defineProperty` rather than a
 * direct assignment, and returns a way to push status updates on demand. */
function installFakeNetworkStatusApi(initial: NetworkStatus): {
  push: (status: NetworkStatus) => void;
} {
  const listeners = new Set<(status: NetworkStatus) => void>();
  const api: NetworkStatusApi = {
    getStatus: vi.fn().mockResolvedValue(initial),
    onStatusChanged: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
  Object.defineProperty(window, "networkStatus", { value: api, configurable: true });
  return {
    push: (status) => {
      for (const listener of listeners) listener(status);
    },
  };
}

describe("useLastfmFetch", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "networkStatus");
  });

  it("fetches on mount and returns the resolved data", async () => {
    const call = vi.fn().mockResolvedValue("ok");
    const { result } = renderHook(() => useLastfmFetch("empty", call, []));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.data).toBe("ok");
    expect(result.current.error).toBeUndefined();
  });

  it("sets error and keeps emptyData on a failed initial fetch", async () => {
    const call = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useLastfmFetch("empty", call, []));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.data).toBe("empty");
    expect(result.current.error).toBe("boom");
  });

  it("auto-retries via refetch once network status flips from offline to online, only when there is a current error", async () => {
    // `push` must come from the SAME api instance the hook subscribes to at mount —
    // installing a second, fresh api after mount would register the hook's listener
    // on a different `listeners` Set than any later `push` call reaches.
    const { push } = installFakeNetworkStatusApi({ online: true, pendingCount: 0, lastSyncedAt: null });
    let callCount = 0;
    const call = vi.fn(() => {
      callCount += 1;
      return callCount === 1 ? Promise.reject(new Error("boom")) : Promise.resolve("ok");
    });

    const { result } = renderHook(() => useLastfmFetch("empty", call, []));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.error).toBe("boom");
    expect(call).toHaveBeenCalledTimes(1);

    act(() => {
      push({ online: false, pendingCount: 0, lastSyncedAt: null });
    });
    act(() => {
      push({ online: true, pendingCount: 0, lastSyncedAt: 1_700_000_000 });
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(call).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe("ok");
    expect(result.current.error).toBeUndefined();
  });

  it("does not re-fetch on reconnect when there is no current error", async () => {
    const { push } = installFakeNetworkStatusApi({ online: true, pendingCount: 0, lastSyncedAt: null });
    const call = vi.fn().mockResolvedValue("ok");
    renderHook(() => useLastfmFetch("empty", call, []));
    await act(async () => {
      await Promise.resolve();
    });
    expect(call).toHaveBeenCalledTimes(1);

    act(() => {
      push({ online: false, pendingCount: 0, lastSyncedAt: null });
    });
    act(() => {
      push({ online: true, pendingCount: 0, lastSyncedAt: 1_700_000_001 });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(call).toHaveBeenCalledTimes(1);
  });
});

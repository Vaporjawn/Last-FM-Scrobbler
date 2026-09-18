import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NetworkStatus } from "@lastfm-scrobbler/core";
import type { NetworkStatusApi } from "../../src/shared/network-status-api.js";
import { useNetworkStatus } from "../../src/renderer/src/hooks/use-network-status.js";

const IDLE: NetworkStatus = { online: null, pendingCount: 0, lastSyncedAt: null };

/** Matches `use-updates.test.ts`'s own `installFakeUpdatesApi` convention — bypasses
 * `window.networkStatus`'s `readonly` typing via `Object.defineProperty` rather than a
 * direct assignment. */
function installFakeNetworkStatusApi(getStatus: NetworkStatusApi["getStatus"]): {
  emitStatusChanged: (status: NetworkStatus) => void;
} {
  const listeners = new Set<(status: NetworkStatus) => void>();
  const api: NetworkStatusApi = {
    getStatus,
    onStatusChanged: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
  Object.defineProperty(window, "networkStatus", { value: api, configurable: true });

  return {
    emitStatusChanged: (status) => {
      for (const listener of listeners) listener(status);
    },
  };
}

describe("useNetworkStatus", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "networkStatus");
  });

  it("returns the idle default when window.networkStatus is absent", () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.status).toEqual(IDLE);
  });

  it("pulls the current status on mount", async () => {
    const online: NetworkStatus = { online: true, pendingCount: 2, lastSyncedAt: 1_700_000_000 };
    installFakeNetworkStatusApi(vi.fn().mockResolvedValue(online));

    const { result } = renderHook(() => useNetworkStatus());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toEqual(online);
  });

  it("applies a pushed status update", () => {
    const { emitStatusChanged } = installFakeNetworkStatusApi(vi.fn().mockResolvedValue(IDLE));
    const { result } = renderHook(() => useNetworkStatus());

    const offline: NetworkStatus = { online: false, pendingCount: 5, lastSyncedAt: 1_700_000_000 };
    act(() => {
      emitStatusChanged(offline);
    });

    expect(result.current.status).toEqual(offline);
  });

  it("unsubscribes on unmount", () => {
    let unsubscribed = false;
    const api: NetworkStatusApi = {
      getStatus: vi.fn().mockResolvedValue(IDLE),
      onStatusChanged: () => () => {
        unsubscribed = true;
      },
    };
    Object.defineProperty(window, "networkStatus", { value: api, configurable: true });
    const { unmount } = renderHook(() => useNetworkStatus());

    unmount();

    expect(unsubscribed).toBe(true);
  });
});

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NetworkStatus } from "@lastfm-scrobbler/core";
import type { NetworkStatusApi } from "../../src/shared/network-status-api.js";
import { NetworkStatusChip } from "../../src/renderer/src/components/NetworkStatusChip.js";

/** Matches `use-updates.test.ts`'s own `installFakeUpdatesApi` convention — bypasses
 * `window.networkStatus`'s `readonly` typing via `Object.defineProperty` rather than a
 * direct assignment. */
function stubNetworkStatus(status: NetworkStatus): void {
  const listeners = new Set<(status: NetworkStatus) => void>();
  const api: NetworkStatusApi = {
    getStatus: vi.fn().mockResolvedValue(status),
    onStatusChanged: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
  Object.defineProperty(window, "networkStatus", { value: api, configurable: true });
}

describe("NetworkStatusChip", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "networkStatus");
  });

  it("renders nothing when online is null and nothing is pending", () => {
    stubNetworkStatus({ online: null, pendingCount: 0, lastSyncedAt: null });
    const { container } = render(<NetworkStatusChip collapsed={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when fully synced (online, nothing pending)", () => {
    stubNetworkStatus({ online: true, pendingCount: 0, lastSyncedAt: 1_700_000_000 });
    const { container } = render(<NetworkStatusChip collapsed={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows Offline when online is false", async () => {
    stubNetworkStatus({ online: false, pendingCount: 0, lastSyncedAt: null });
    render(<NetworkStatusChip collapsed={false} />);
    // `useNetworkStatus` resolves `getStatus()` asynchronously, so the chip renders
    // nothing on the first synchronous pass — `findByText` (unlike `getByText`) waits
    // for that microtask to settle before asserting.
    expect(await screen.findByText("Offline")).toBeInTheDocument();
  });

  it("shows the pending count while online", async () => {
    stubNetworkStatus({ online: true, pendingCount: 3, lastSyncedAt: 1_700_000_000 });
    render(<NetworkStatusChip collapsed={false} />);
    expect(await screen.findByText("3 pending")).toBeInTheDocument();
  });

  it("collapsed shows an icon-only chip with an accessible label", async () => {
    stubNetworkStatus({ online: false, pendingCount: 2, lastSyncedAt: null });
    render(<NetworkStatusChip collapsed />);
    expect(await screen.findByLabelText("Offline, 2 pending")).toBeInTheDocument();
  });
});

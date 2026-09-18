import { useEffect, useState } from "react";
import type { NetworkStatus } from "@lastfm-scrobbler/core";

export interface UseNetworkStatusResult {
  readonly status: NetworkStatus;
}

const IDLE: NetworkStatus = { online: null, pendingCount: 0, lastSyncedAt: null };

/**
 * Subscribes to `window.networkStatus` (exposed by the preload script — see
 * `src/shared/network-status-api.ts`). Pulls the current status on mount in addition
 * to subscribing to push updates, same reasoning as `useUpdates`. Returns the inert
 * `IDLE` default — never throws — when `window.networkStatus` isn't present, which is
 * expected outside a real Electron renderer (e.g. component tests) or in a build with
 * no secure account storage available (see `main/index.ts`'s `networkStatus`
 * construction).
 */
export function useNetworkStatus(): UseNetworkStatusResult {
  const [status, setStatus] = useState<NetworkStatus>(IDLE);

  useEffect(() => {
    if (!window.networkStatus) {
      return;
    }
    let cancelled = false;
    // Same "a later push always wins over a slower-resolving initial pull" reasoning
    // as `useUpdates` — see that hook's own `hasReceivedPush` comment.
    let hasReceivedPush = false;

    window.networkStatus
      .getStatus()
      .then((current) => {
        if (!cancelled && !hasReceivedPush) {
          setStatus(current);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to fetch the current network status:", error);
      });

    const unsubscribe = window.networkStatus.onStatusChanged((next) => {
      hasReceivedPush = true;
      setStatus(next);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { status };
}

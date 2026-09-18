import type { NetworkStatus } from "@lastfm-scrobbler/core";

/**
 * The renderer-facing network-status API the preload script exposes via
 * `contextBridge.exposeInMainWorld("networkStatus", ...)`. See
 * `main/network/wire-network-status.ts` and docs/modules/desktop.md's "Network status
 * / offline mode" section.
 */
export interface NetworkStatusApi {
  /** The latest known status — resolves immediately with whatever's currently known
   * (starts at `{ online: null, pendingCount: 0, lastSyncedAt: null }` if nothing has
   * been reported yet this run), same "pull current state" reasoning as
   * `UpdatesApi.getStatus()`. */
  getStatus(): Promise<NetworkStatus>;
  onStatusChanged(callback: (status: NetworkStatus) => void): () => void;
}

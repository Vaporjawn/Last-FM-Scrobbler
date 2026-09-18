import type { BrowserWindow, Tray } from "electron";
import type { NetworkStatus, NetworkStatusMonitor } from "@lastfm-scrobbler/core";
import electron from "electron";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

export interface WireNetworkStatusOptions {
  readonly monitor: NetworkStatusMonitor;
  /** A live accessor, not a captured value — same "read fresh on every push" reasoning
   * as `wire-updates.ts`'s `getMainWindow`. */
  readonly getMainWindow: () => BrowserWindow | undefined;
  /** May return `undefined` — the tray icon is created after this module is wired
   * (see `main/index.ts`), so status changes before then have nothing to update. Call
   * `syncTrayTooltip()` once right after the tray actually exists to catch up. */
  readonly getTray: () => Tray | undefined;
}

export interface NetworkStatusHandle {
  /** Re-applies whatever the monitor's current status is to `getTray()`'s current
   * return value — call once right after the tray is created. */
  syncTrayTooltip: () => void;
  stop: () => void;
}

function formatTooltip(status: NetworkStatus): string {
  const base = "Last.fm Scrobbler";
  if (status.online === false) {
    return status.pendingCount > 0
      ? `${base} — Offline, ${status.pendingCount} pending`
      : `${base} — Offline`;
  }
  return status.pendingCount > 0 ? `${base} — ${status.pendingCount} pending` : base;
}

/**
 * Pushes `monitor`'s status to the renderer over `IPC_CHANNELS.networkStatusChanged`
 * (mirrors `wire-updates.ts`'s push pattern exactly) and keeps the tray icon's tooltip
 * in sync — see `formatTooltip` for the exact text per state. Registers
 * `IPC_CHANNELS.networkStatusGetStatus` for the renderer's initial pull.
 */
export function wireNetworkStatus(options: WireNetworkStatusOptions): NetworkStatusHandle {
  const { monitor, getMainWindow, getTray } = options;

  function apply(status: NetworkStatus): void {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.networkStatusChanged, status);
    }
    const tray = getTray();
    if (tray) {
      tray.setToolTip(formatTooltip(status));
    }
  }

  const unsubscribe = monitor.subscribe(apply);

  ipcMain.handle(IPC_CHANNELS.networkStatusGetStatus, (): NetworkStatus => monitor.getStatus());

  return {
    syncTrayTooltip: () => {
      const tray = getTray();
      if (tray) {
        tray.setToolTip(formatTooltip(monitor.getStatus()));
      }
    },
    stop: () => {
      unsubscribe();
      ipcMain.removeHandler(IPC_CHANNELS.networkStatusGetStatus);
    },
  };
}

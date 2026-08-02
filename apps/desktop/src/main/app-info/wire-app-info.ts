import electron from "electron";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

export interface WireAppInfoOptions {
  /** Real callers pass `() => app.getVersion()` — injected for easy testing, and so
   * this module doesn't need to import Electron's `app` singleton itself. */
  readonly getVersion: () => string;
  /** Brings the main window to the front — the tray mini-player popover's "Open
   * Last.fm Scrobbler" button calls this (see `TrayPopover.tsx`) rather than
   * duplicating `main/index.ts`'s own `mainWindow.show(); mainWindow.focus();` tray
   * "Show" handler. Optional so callers that genuinely have no main window yet (this
   * module's own tests) don't need to provide one. */
  readonly onShowMainWindow?: () => void;
}

/** Wires the app-info IPC surface (see `shared/app-info-api.ts`) — the running app's
 * own version (shown in Settings → General) and a way for the tray popover to bring
 * the main window forward. */
export function wireAppInfo(options: WireAppInfoOptions): () => void {
  const { getVersion, onShowMainWindow } = options;

  ipcMain.handle(IPC_CHANNELS.appGetVersion, (): string => getVersion());
  ipcMain.handle(IPC_CHANNELS.appShowMainWindow, (): void => {
    onShowMainWindow?.();
  });

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.appGetVersion);
    ipcMain.removeHandler(IPC_CHANNELS.appShowMainWindow);
  };
}

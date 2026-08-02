import electron from "electron";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

export interface WireAppInfoOptions {
  /** Real callers pass `() => app.getVersion()` — injected for easy testing, and so
   * this module doesn't need to import Electron's `app` singleton itself. */
  readonly getVersion: () => string;
}

/** Wires the app-info IPC surface (see `shared/app-info-api.ts`) — currently just the
 * running app's own version, shown in Settings → General. */
export function wireAppInfo(options: WireAppInfoOptions): () => void {
  const { getVersion } = options;

  ipcMain.handle(IPC_CHANNELS.appGetVersion, (): string => getVersion());

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.appGetVersion);
  };
}

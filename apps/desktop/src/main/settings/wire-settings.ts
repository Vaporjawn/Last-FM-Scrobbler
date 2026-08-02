import electron from "electron";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";
import type { AppSettings } from "../../shared/settings-api.js";
import type { SettingsStore } from "./settings-store.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

export interface WireSettingsOptions {
  readonly store: SettingsStore;
}

/** Wires the settings IPC surface (see `shared/settings-api.ts`) to a real `SettingsStore`. */
export function wireSettings(options: WireSettingsOptions): () => void {
  const { store } = options;

  ipcMain.handle(IPC_CHANNELS.settingsGet, (): AppSettings => store.get());

  ipcMain.handle(
    IPC_CHANNELS.settingsSet,
    (_event, patch: unknown): AppSettings => store.set(patch as Partial<AppSettings>),
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.settingsGet);
    ipcMain.removeHandler(IPC_CHANNELS.settingsSet);
  };
}

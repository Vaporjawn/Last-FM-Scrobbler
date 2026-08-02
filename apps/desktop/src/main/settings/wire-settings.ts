import electron from "electron";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";
import type { AppSettings, AspectRatioOption } from "../../shared/settings-api.js";
import type { SettingsStore } from "./settings-store.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

export interface WireSettingsOptions {
  readonly store: SettingsStore;
  /** Called immediately whenever a `set()` patch changes `aspectRatio` — lets the
   * caller apply the new ratio to the already-open window
   * (`mainWindow.setAspectRatio(...)`, via `main/window/resolve-aspect-ratio.ts`)
   * without waiting for a restart. Optional so callers that don't care about live
   * window updates (including this module's own tests) don't need to provide one. */
  readonly onAspectRatioChange?: (aspectRatio: AspectRatioOption) => void;
}

/** Wires the settings IPC surface (see `shared/settings-api.ts`) to a real `SettingsStore`. */
export function wireSettings(options: WireSettingsOptions): () => void {
  const { store, onAspectRatioChange } = options;

  ipcMain.handle(IPC_CHANNELS.settingsGet, (): AppSettings => store.get());

  ipcMain.handle(IPC_CHANNELS.settingsSet, (_event, patch: unknown): AppSettings => {
    const typedPatch = patch as Partial<AppSettings>;
    const updated = store.set(typedPatch);
    if (typedPatch.aspectRatio !== undefined) {
      onAspectRatioChange?.(updated.aspectRatio);
    }
    return updated;
  });

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.settingsGet);
    ipcMain.removeHandler(IPC_CHANNELS.settingsSet);
  };
}

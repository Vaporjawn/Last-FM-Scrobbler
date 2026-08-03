import electron from "electron";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";
import { isAspectRatioOption } from "../../shared/settings-api.js";
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
  /** Called immediately whenever a `set()` patch changes `launchAtLogin` — lets the
   * caller live-update the OS login-item registration
   * (`main/login-items/apply-login-item-settings.ts`) without waiting for a restart,
   * same reasoning as `onAspectRatioChange`. Deliberately **not** fired for a
   * `startMinimized`-only patch: unlike `launchAtLogin`, `startMinimized` has no live
   * effect to apply — it only matters at the next login-triggered launch (see
   * `create-main-window.ts`'s `startHidden` option). Optional, same reasoning as
   * `onAspectRatioChange`. */
  readonly onLaunchAtLoginChange?: (launchAtLogin: boolean) => void;
  /** Called immediately whenever a `set()` patch changes `showDockIcon` — lets the
   * caller live-update the Dock icon (`main/dock/apply-dock-icon-visibility.ts`)
   * without waiting for a restart, same reasoning as `onAspectRatioChange`. Note
   * there's no `onShowTrayIconChange` counterpart: see `AppSettings.showTrayIcon`'s
   * docstring for why that one is deliberately applied once at startup only. Optional,
   * same reasoning as `onAspectRatioChange`. */
  readonly onShowDockIconChange?: (showDockIcon: boolean) => void;
}

/** Wires the settings IPC surface (see `shared/settings-api.ts`) to a real `SettingsStore`. */
export function wireSettings(options: WireSettingsOptions): () => void {
  const { store, onAspectRatioChange, onLaunchAtLoginChange, onShowDockIconChange } = options;

  ipcMain.handle(IPC_CHANNELS.settingsGet, (): AppSettings => store.get());

  ipcMain.handle(IPC_CHANNELS.settingsSet, (_event, patch: unknown): AppSettings => {
    const typedPatch = patch as Partial<AppSettings>;
    // Validated here, at the trust boundary, rather than trusting the renderer (or a
    // stale/corrupted settings.json migrated forward via a prior `store.set()` call)
    // to only ever send a real AspectRatioOption — an invalid value used to flow
    // straight through into NaN window-geometry math (see `isAspectRatioOption`'s own
    // docstring for the full failure chain).
    if (typedPatch.aspectRatio !== undefined && !isAspectRatioOption(typedPatch.aspectRatio)) {
      throw new Error(`settings:set received an invalid aspectRatio: ${String(typedPatch.aspectRatio)}`);
    }
    const updated = store.set(typedPatch);
    if (typedPatch.aspectRatio !== undefined) {
      onAspectRatioChange?.(updated.aspectRatio);
    }
    if (typedPatch.launchAtLogin !== undefined) {
      onLaunchAtLoginChange?.(updated.launchAtLogin);
    }
    if (typedPatch.showDockIcon !== undefined) {
      onShowDockIconChange?.(updated.showDockIcon);
    }
    return updated;
  });

  ipcMain.handle(IPC_CHANNELS.settingsReset, (): AppSettings => {
    const defaults = store.reset();
    // Unconditional, unlike settingsSet's guards above: reset() always changes every
    // field back to its default (or leaves it unchanged if already default, which
    // re-applying is a harmless no-op), so there's no "did this actually change"
    // check needed the way a partial patch requires one.
    onAspectRatioChange?.(defaults.aspectRatio);
    onLaunchAtLoginChange?.(defaults.launchAtLogin);
    onShowDockIconChange?.(defaults.showDockIcon);
    return defaults;
  });

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.settingsGet);
    ipcMain.removeHandler(IPC_CHANNELS.settingsSet);
    ipcMain.removeHandler(IPC_CHANNELS.settingsReset);
  };
}

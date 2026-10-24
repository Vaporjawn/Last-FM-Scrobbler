import electron from "electron";
import { join } from "node:path";
import { applyDockIconVisibility } from "../dock/apply-dock-icon-visibility.js";
import { applyLoginItemSettings } from "../login-items/apply-login-item-settings.js";
import { createSettingsStore } from "../settings/settings-store.js";

const { app } = electron;

/**
 * Opens the persisted settings store and applies the two settings that act on the OS at
 * startup (login-item registration and dock-icon visibility). Both are kept live afterwards
 * by `wireSettings`'s change callbacks, so this only handles the initial state.
 */
export function createStartupSettingsStore(userDataDir: string) {
  const settingsStore = createSettingsStore({ filePath: join(userDataDir, "settings.json") });

  // Registers (or unregisters) this app as an OS login item to match the persisted
  // setting — see AppSettings.launchAtLogin's docstring for the macOS/Windows-only,
  // Linux-is-a-no-op platform reality this call encodes. Applied once here at startup;
  // wireSettings's onLaunchAtLoginChange below keeps it live-updated after that without
  // needing a restart.
  applyLoginItemSettings(app, settingsStore.get().launchAtLogin);
  // Same "applied once at startup, then kept live" split as launchAtLogin above — see
  // AppSettings.showDockIcon's docstring.
  applyDockIconVisibility(app, settingsStore.get().showDockIcon);

  return settingsStore;
}

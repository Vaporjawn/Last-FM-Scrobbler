import { showNotification } from "../notifications/show-notification.js";
import type { createSettingsStore } from "../settings/settings-store.js";

/**
 * Builds the callback `wireCloseToTray` runs when the window is hidden to the tray.
 *
 * The very first time the window is hidden (across this install's whole lifetime, tracked via
 * `AppSettings.hasShownTrayHint`, not just this run) it explains where the app went. Every
 * call after the first is a no-op: the settings write on the first call makes
 * `hasShownTrayHint` true from then on, and it is deliberately not re-checked-and-reset
 * anywhere, so it really only ever fires once per install.
 */
export function createTrayHideHandler(
  settingsStore: ReturnType<typeof createSettingsStore>,
  notificationIconOption: { readonly icon?: string },
): () => void {
  return () => {
    if (settingsStore.get().hasShownTrayHint) {
      return;
    }
    settingsStore.set({ hasShownTrayHint: true });
    const place = process.platform === "darwin" ? "menu bar" : "tray";
    showNotification({
      title: "Still running",
      body: `Last.fm Scrobbler is still running in the ${place} — scrobbling continues in the background. Quit from there when you're done.`,
      ...notificationIconOption,
    });
  };
}

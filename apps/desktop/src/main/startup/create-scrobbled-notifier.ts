import { showNotification } from "../notifications/show-notification.js";
import type { createSettingsStore } from "../settings/settings-store.js";

/**
 * Builds the `onScrobbled` callback: a "Scrobbled" native notification naming the first track
 * (and how many more were in the batch).
 *
 * The notification setting is read fresh on every call, not captured once at wiring time, so
 * toggling Settings → Notifications takes effect immediately with no restart, the same way
 * the tray-hide hint and `wireUpdates` read `settingsStore.get()` at the point each
 * notification actually fires.
 */
export function createScrobbledNotifier(
  settingsStore: ReturnType<typeof createSettingsStore>,
  notificationIconOption: { readonly icon?: string },
) {
  return (items: readonly { readonly track: string; readonly artist: string }[]): void => {
    if (!settingsStore.get().notifyOnScrobble) {
      return;
    }
    const [first] = items;
    if (!first) {
      return;
    }
    showNotification({
      title: "Scrobbled",
      body:
        items.length === 1
          ? `${first.track} — ${first.artist}`
          : `${first.track} — ${first.artist} and ${String(items.length - 1)} more`,
      ...notificationIconOption,
    });
  };
}

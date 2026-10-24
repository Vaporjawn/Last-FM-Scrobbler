import { showNotification } from "../notifications/show-notification.js";
import type { createSettingsStore } from "../settings/settings-store.js";

/**
 * Builds the `onScrobbleFailed` callback: a native notification saying scrobbling cannot reach
 * the connected services and will keep retrying. Gated on
 * `AppSettings.notifyOnScrobbleFailure`, read fresh on every call.
 */
export function createScrobbleFailureNotifier(
  settingsStore: ReturnType<typeof createSettingsStore>,
  notificationIconOption: { readonly icon?: string },
) {
  return (reason: string): void => {
    if (!settingsStore.get().notifyOnScrobbleFailure) {
      return;
    }
    showNotification({
      title: "Scrobbling is having trouble reaching your connected services",
      body: `${reason} — will keep retrying in the background.`,
      ...notificationIconOption,
    });
  };
}

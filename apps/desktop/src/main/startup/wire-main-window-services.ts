import electron from "electron";
import type { Logger, NetworkStatusMonitor } from "@lastfm-scrobbler/core";
import { wireAppInfo } from "../app-info/wire-app-info.js";
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH } from "../create-main-window.js";
import { applyDockIconVisibility } from "../dock/apply-dock-icon-visibility.js";
import { applyLoginItemSettings } from "../login-items/apply-login-item-settings.js";
import { wireNetworkStatus, type NetworkStatusHandle } from "../network/wire-network-status.js";
import { showNotification } from "../notifications/show-notification.js";
import type { createSettingsStore } from "../settings/settings-store.js";
import { wireSettings } from "../settings/wire-settings.js";
import { createUpdaterClient } from "../updates/create-updater-client.js";
import { showRestartPrompt } from "../updates/show-restart-prompt.js";
import { wireUpdates } from "../updates/wire-updates.js";
import { applyAspectRatio } from "../window/apply-aspect-ratio.js";

const { app, screen } = electron;

/** What `wireMainWindowServices` needs from the rest of startup. */
export interface WireMainWindowServicesOptions {
  readonly expectedOrigin: string;
  readonly logger: Logger;
  readonly settingsStore: ReturnType<typeof createSettingsStore>;
  readonly networkStatus: NetworkStatusMonitor | undefined;
  readonly notificationIconOption: { readonly icon?: string };
  /** Live accessor for the current main window, which can be replaced after `activate`. */
  readonly getMainWindow: () => Electron.BrowserWindow;
  /** Live accessor for the tray, which is created after these services are wired. */
  readonly getTray: () => Electron.Tray | undefined;
}

/**
 * Wires every service that acts on the main window or reacts to settings: the offline-mode
 * network status surface, app info, live settings changes and auto-update. Returns the network
 * status handle (or `undefined` when there is no monitor) so the tray tooltip can be synced
 * once the tray exists.
 */
export function wireMainWindowServices(
  options: WireMainWindowServicesOptions,
): NetworkStatusHandle | undefined {
  const {
    expectedOrigin,
    logger,
    settingsStore,
    networkStatus,
    notificationIconOption,
    getMainWindow,
    getTray,
  } = options;

  // `undefined` under the exact same condition `networkStatus` itself is (see its
  // construction above) — nothing to push/sync in that case, so this whole block is
  // just skipped rather than wiring an inert monitor.
  const networkStatusHandle = networkStatus
    ? wireNetworkStatus({
        expectedOrigin,
        monitor: networkStatus,
        // Live accessors, not captured values — same "read fresh on every push"
        // reasoning as wireUpdates'/wireAppInfo's own getMainWindow/onShowMainWindow
        // right below, and as `tray` itself (module-scope, assigned further down once
        // the tray block runs).
        getMainWindow,
        getTray,
      })
    : undefined;

  wireAppInfo({
    expectedOrigin,
    getVersion: () => app.getVersion(),
    // Reads the live `mainWindow` binding, not a stale reference, matching
    // `wireSettings`'s own `onAspectRatioChange` right below — keeps working
    // correctly after the `activate` handler further down replaces it.
    onShowMainWindow: () => {
      getMainWindow().show();
      getMainWindow().focus();
    },
  });

  wireSettings({
    expectedOrigin,
    store: settingsStore,
    // Applies a Settings → Window aspect-ratio change to the already-open window
    // immediately, rather than waiting for the user to restart the app — reads the
    // live `mainWindow` binding below, not a stale reference, so this keeps working
    // correctly after the `activate` handler further down replaces it. See
    // `applyAspectRatio`'s own docstring for why it clears the constraint before
    // resizing rather than resizing directly to the new ratio, and why it needs the
    // *current* display's work area (not a cached one — the window may have moved to
    // a different display since the last change) to keep the minimum size it enforces
    // from exceeding what that screen can actually fit.
    onAspectRatioChange: (aspectRatio) => {
      const { workArea } = screen.getDisplayMatching(getMainWindow().getBounds());
      applyAspectRatio(getMainWindow(), aspectRatio, {
        minWidth: MIN_WINDOW_WIDTH,
        minHeight: MIN_WINDOW_HEIGHT,
        availableWidth: workArea.width,
        availableHeight: workArea.height,
      });
    },
    // Keeps the OS login-item registration in sync the moment the setting changes,
    // rather than only applying it on the next launch — same live-update reasoning as
    // onAspectRatioChange above.
    onLaunchAtLoginChange: (launchAtLogin) => {
      applyLoginItemSettings(app, launchAtLogin);
    },
    // Same live-update reasoning as onAspectRatioChange/onLaunchAtLoginChange above —
    // see AppSettings.showDockIcon's docstring for why this one (unlike
    // showTrayIcon) is safe to apply immediately with no restart needed.
    onShowDockIconChange: (showDockIcon) => {
      applyDockIconVisibility(app, showDockIcon);
    },
  });

  // Wired once for the app's whole lifetime (not re-wired in "activate" below, unlike
  // wireCloseToTray) — checks/downloads are a per-process concern, not a per-window
  // one, and re-wiring would attach duplicate listeners to the long-lived autoUpdater
  // singleton and restart its check interval. See docs/modules/desktop.md's
  // "Auto-update" section.
  const updaterClient = createUpdaterClient({ logger });
  wireUpdates({
    expectedOrigin,
    client: updaterClient,
    // Live accessor, not the `mainWindow` value at this point in time — the main
    // window can be closed and recreated (see `app.on("activate")` below) for as long
    // as this stays wired; reading through the outer `let mainWindow` binding here
    // keeps status pushes targeting whichever window is actually current, matching
    // `wireAppInfo`'s `onShowMainWindow`/`wireSettings`'s `onAspectRatioChange` right
    // above.
    getMainWindow,
    isAutoCheckEnabled: () => settingsStore.get().autoUpdateEnabled,
    promptToRestart: (version) => showRestartPrompt(getMainWindow(), version),
    onUpdateAvailable: (version) => {
      showNotification({
        title: "Update available",
        body: `Downloading Last.fm Scrobbler ${version} in the background…`,
        ...notificationIconOption,
      });
    },
    onUpdateCheckFailed: (message) => {
      showNotification({
        title: "Couldn't check for updates",
        body: message,
        ...notificationIconOption,
      });
    },
  });

  // Both skipped entirely when Settings → General's "Show application icon in the
  // tray/menu bar" is off — see AppSettings.showTrayIcon's docstring for why this is
  // applied once here at startup only, not live-toggled the way showDockIcon is.
  // `trayPopover` has no purpose other than being the tray's own popover, so there's
  // nothing to create at all once the tray icon itself isn't going to exist.

  return networkStatusHandle;
}

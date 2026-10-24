import electron from "electron";
import { createTray } from "../tray/create-tray.js";
import { createTrayPopoverWindow } from "../tray/create-tray-popover-window.js";
import { resolvePopoverScreenBounds } from "../tray/resolve-popover-screen-bounds.js";
import { resolveTrayIconPath } from "../tray/resolve-tray-icon-path.js";
import type { NetworkStatusHandle } from "../network/wire-network-status.js";
import type { createSettingsStore } from "../settings/settings-store.js";
import type { ResolveResourcePathOptions } from "../resolve-resource-path.js";

const { app } = electron;

/** What `createTrayWhenEnabled` needs from the rest of startup. */
export interface CreateTrayWhenEnabledOptions {
  readonly settingsStore: ReturnType<typeof createSettingsStore>;
  readonly resourcePathOptions: ResolveResourcePathOptions;
  readonly networkStatusHandle: NetworkStatusHandle | undefined;
  /** Live accessor for the current main window. */
  readonly getMainWindow: () => Electron.BrowserWindow;
  /** Marks the app as really quitting so the close-to-tray handler lets windows close. */
  readonly markQuitting: () => void;
}

/**
 * Creates the tray icon and its popover window, unless Settings → General's "Show application
 * icon in the tray/menu bar" is off. Applied once at startup only, not live-toggled the way the
 * dock icon is (see `AppSettings.showTrayIcon`). The popover has no purpose other than being the
 * tray's own, so nothing is created at all when the icon itself will not exist.
 *
 * Returns the tray so the caller can keep a reference: Electron's `Tray` is garbage collected,
 * and its icon silently disappears, if nothing holds it.
 */
export function createTrayWhenEnabled(
  options: CreateTrayWhenEnabledOptions,
): Electron.Tray | undefined {
  if (!options.settingsStore.get().showTrayIcon) {
    return undefined;
  }
  const { getMainWindow } = options;

  // Created hidden, up front — see create-tray-popover-window.ts. Not tied to
  // mainWindow's own lifecycle (recreated in the "activate" handler below); the
  // popover is cheap to leave alive for the whole app session and doesn't need to be
  // recreated just because the main window was.
  const trayPopover = createTrayPopoverWindow();

  const tray = createTray({
    iconPath: resolveTrayIconPath(options.resourcePathOptions),
    popover: trayPopover,
    resolvePopoverScreenBounds,
    onShow: () => {
      getMainWindow().show();
      getMainWindow().focus();
    },
    onQuit: () => {
      options.markQuitting();
      app.quit();
    },
  });
  // Catches up the tooltip to whatever status is already known — `tray` didn't
  // exist yet when networkStatusHandle was wired above, so any status change
  // before this point had nothing to apply its tooltip text to.
  options.networkStatusHandle?.syncTrayTooltip();
  return tray;
}

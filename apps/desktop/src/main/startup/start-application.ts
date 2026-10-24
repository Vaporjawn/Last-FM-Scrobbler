import electron from "electron";
import type { Logger } from "@lastfm-scrobbler/core";
import type { PlaybackSource } from "@lastfm-scrobbler/shared-types";
import { resolveStartHidden } from "../window/resolve-start-hidden.js";
import { createAndWireMainWindow } from "./create-and-wire-main-window.js";
import { createLastfmServices } from "./create-lastfm-services.js";
import { createSecretStores } from "./create-secret-stores.js";
import { createStartupSettingsStore } from "./create-startup-settings-store.js";
import { createTrayHideHandler } from "./create-tray-hide-handler.js";
import { createTrayWhenEnabled } from "./create-tray-when-enabled.js";
import { loadDevelopmentEnvFile } from "./load-development-env-file.js";
import { registerAppLifecycleHandlers } from "./register-app-lifecycle-handlers.js";
import { resolveStartupResources } from "./resolve-startup-resources.js";
import { wireBugReportDiagnostics } from "./wire-bug-report-diagnostics.js";
import { wireLastfmDataServices } from "./wire-lastfm-data-services.js";
import { wireLoginServices } from "./wire-login-services.js";
import { wireMainWindowServices } from "./wire-main-window-services.js";
import { wireScrobblingService } from "./wire-scrobbling-service.js";

const { app } = electron;

/** What `startApplication` needs from the entry module. */
export interface StartApplicationOptions {
  /** The origin every IPC call must genuinely come from; see `security/assert-trusted-sender.ts`. */
  readonly expectedRendererOrigin: string;
  readonly logger: Logger;
  /**
   * Constructed once at app startup, not per-window: it may spawn a real OS-level process (see
   * `packages/adapter-macos`), and there should only ever be one of those per app instance
   * regardless of how many windows come and go.
   */
  readonly playbackSource: PlaybackSource | undefined;
}

/**
 * Boots the app once Electron is ready: loads the development `.env`, opens settings and
 * secure storage, builds the Last.fm services, wires every IPC surface, creates the main
 * window and tray, and registers the lifecycle handlers.
 *
 * It owns the few pieces of mutable state the steps share (whether the app is really quitting,
 * the tray, the current main window) and hands each step live accessors rather than values, so
 * a replaced window or a late-created tray is always the one that is read.
 */
export async function startApplication(options: StartApplicationOptions): Promise<void> {
  const { expectedRendererOrigin, logger, playbackSource } = options;

  loadDevelopmentEnvFile();

  const resources = resolveStartupResources();
  const { userDataDir, resourcePathOptions, appIconPath, notificationIconOption } = resources;
  const settingsStore = createStartupSettingsStore(userDataDir);
  const secretStores = createSecretStores(userDataDir, logger);
  const lastfmServices = await createLastfmServices({
    userDataDir,
    accountStore: secretStores.accountStore,
    appCredentialsStore: secretStores.appCredentialsStore,
    logger,
  });

  // Set right before a *real* quit (the tray's "Quit" item, or `before-quit` from Cmd+Q/OS
  // shutdown/etc.) so `wireCloseToTray` lets that close through instead of hiding the window
  // again. `tray` is kept here too: Electron's `Tray` is garbage collected (and its icon
  // silently disappears) if nothing holds a reference to it.
  let isQuitting = false;
  let tray: Electron.Tray | undefined = undefined;
  /** Flags that the app is really quitting, so closing the window is no longer turned into a hide. */
  const markQuitting = (): void => {
    isQuitting = true;
  };

  wireLoginServices({
    expectedOrigin: expectedRendererOrigin,
    logger,
    secretStores,
    lastfmServices,
    notificationIconOption,
    markQuitting,
  });
  wireLastfmDataServices(expectedRendererOrigin, lastfmServices);

  const scrobbling = wireScrobblingService({
    secretStores,
    lastfmServices,
    settingsStore,
    notificationIconOption,
  });

  wireBugReportDiagnostics(expectedRendererOrigin, logger);

  const onTrayHide = createTrayHideHandler(settingsStore, notificationIconOption);
  /**
   * Builds a fully wired main window with the scrobbling hooks and close-to-tray behavior
   * attached. Used for the first window and again when the lifecycle handlers need a new one;
   * `startHidden` creates it without showing it (a login-triggered launch).
   */
  const createWindow = (startHidden?: boolean): Electron.BrowserWindow =>
    createAndWireMainWindow({
      settingsStore,
      logger,
      playbackSource,
      onScrobbleEligible: scrobbling.onScrobbleEligible,
      onTrackChanged: scrobbling.onTrackChanged,
      appIconPath,
      isQuitting: () => isQuitting,
      onHide: onTrayHide,
      ...(startHidden ? { startHidden: true } : {}),
    });

  let mainWindow = createWindow(
    resolveStartHidden(
      settingsStore.get().startMinimized,
      app.getLoginItemSettings().wasOpenedAtLogin,
    ),
  );
  /** Live accessor for the current main window, which is replaced if the window is recreated. */
  const getMainWindow = (): Electron.BrowserWindow => mainWindow;
  /** Live accessor for the tray, which is `undefined` until it is created (or when disabled). */
  const getTray = (): Electron.Tray | undefined => tray;

  const networkStatusHandle = wireMainWindowServices({
    expectedOrigin: expectedRendererOrigin,
    logger,
    settingsStore,
    networkStatus: lastfmServices.networkStatus,
    notificationIconOption,
    getMainWindow,
    getTray,
  });

  tray = createTrayWhenEnabled({
    settingsStore,
    resourcePathOptions,
    networkStatusHandle,
    getMainWindow,
    markQuitting,
  });

  registerAppLifecycleHandlers({
    markQuitting,
    getTray,
    stopScrobbling: scrobbling.stop,
    getMainWindow,
    recreateMainWindow: () => {
      mainWindow = createWindow();
    },
  });
}

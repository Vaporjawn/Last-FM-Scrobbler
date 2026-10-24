import electron from "electron";

const { app, BrowserWindow } = electron;

/** What `registerAppLifecycleHandlers` needs from the rest of startup. */
export interface RegisterAppLifecycleHandlersOptions {
  /** Marks the app as really quitting so the close-to-tray handler lets windows close. */
  readonly markQuitting: () => void;
  /** Live accessor for the tray, so it can be destroyed on quit. */
  readonly getTray: () => Electron.Tray | undefined;
  /** Releases scrobbling resources right before the process exits. */
  readonly stopScrobbling: (() => void) | undefined;
  /** Live accessor for the current main window. */
  readonly getMainWindow: () => Electron.BrowserWindow;
  /** Replaces the main window (creating and wiring a new one) and returns it. */
  readonly recreateMainWindow: () => void;
}

/**
 * Registers the app-level lifecycle handlers: tear down the tray on `before-quit`, release
 * scrobbling on `will-quit`, and on `activate` (macOS dock click) either recreate the window
 * after every window has been closed or bring a hidden one back.
 */
export function registerAppLifecycleHandlers(options: RegisterAppLifecycleHandlersOptions): void {
  app.on("before-quit", () => {
    options.markQuitting();
    options.getTray()?.destroy();
  });

  app.on("will-quit", () => {
    options.stopScrobbling?.();
  });

  app.on("activate", () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) {
      options.recreateMainWindow();
      return;
    }
    // A window already exists but may be hidden (closeToTray) — bring it back rather
    // than leaving the dock/taskbar click with no visible effect.
    options.getMainWindow().show();
    options.getMainWindow().focus();
  });
}

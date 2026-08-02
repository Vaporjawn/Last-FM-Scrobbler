import type { SettingsStore } from "../settings/settings-store.js";

/** The subset of `Electron.BrowserWindow` this needs — narrowed for easy testing.
 * Arrow-function-property syntax (not method shorthand) so callers can reference
 * `window.hide` directly (e.g. in test assertions) without tripping
 * `@typescript-eslint/unbound-method`. */
export interface CloseToTrayWindow {
  readonly on: (event: "close", listener: (event: { preventDefault: () => void }) => void) => void;
  readonly hide: () => void;
}

export interface WireCloseToTrayOptions {
  readonly window: CloseToTrayWindow;
  readonly settingsStore: Pick<SettingsStore, "get">;
  /**
   * Returns whether the app is in the middle of actually quitting (via the tray's
   * "Quit" item, Cmd+Q, `app.quit()`, etc.). A function rather than a plain boolean so
   * callers can share one mutable flag between this, `app.on("before-quit")`, and the
   * tray's "Quit" menu item — without it, every real quit would just re-hide the window
   * instead of exiting.
   */
  readonly isQuitting: () => boolean;
  /** Called every time the window is actually hidden-to-tray (i.e. every time this
   * function's own `event.preventDefault(); window.hide();` branch below runs) — not
   * called on a real quit. `main/index.ts` uses this to show a one-time "still
   * running in the tray/menu bar" native notification the *first* time this happens
   * for the app's whole install (tracked via `AppSettings.hasShownTrayHint`, not
   * re-derived here — this module stays a pure "hide instead of close" policy and
   * leaves notification/persistence decisions to the caller). Optional — defaults to
   * a no-op. */
  readonly onHide?: () => void;
}

/**
 * Makes closing the main window hide it instead of destroying it, when
 * `AppSettings.closeToTray` is enabled (the default — see `shared/settings-api.ts`) and
 * the app isn't actually quitting. This is what keeps the app running in the
 * tray/menu bar so playback tracking and scrobbling continue after the window closes —
 * see `main/tray/create-tray.ts` for the icon that lets the user reopen or quit it.
 */
export function wireCloseToTray(options: WireCloseToTrayOptions): void {
  const { window, settingsStore, isQuitting, onHide } = options;

  window.on("close", (event) => {
    if (isQuitting() || !settingsStore.get().closeToTray) {
      return;
    }
    event.preventDefault();
    window.hide();
    onHide?.();
  });
}

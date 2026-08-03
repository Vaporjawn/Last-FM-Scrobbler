/** The subset of Electron's `app` this module needs — kept narrow for easy testing,
 * same convention as `LoginItemApp` in `main/login-items/apply-login-item-settings.ts`. */
export interface DockApp {
  /** `undefined` on every platform except macOS — matches Electron's own real type
   * for `app.dock` exactly (verified directly against `electron.d.ts`:
   * `readonly dock: (Dock) | (undefined)` — an always-present key whose *value* can
   * be `undefined`, not an omittable optional property, which matters under this
   * project's `exactOptionalPropertyTypes`). `Dock` itself is documented macOS-only. */
  readonly dock: {
    hide(): void;
    show(): Promise<void>;
  } | undefined;
}

/**
 * Shows or hides the Dock icon — the `main/index.ts` startup call and
 * `wire-settings.ts`'s live-update callback both go through this one function, so
 * there's exactly one place deciding whether the call is even meaningful for the
 * current platform. A no-op everywhere `app.dock` is `undefined` (every platform but
 * macOS), same "just not present there" contract `applyLoginItemSettings` already
 * follows for its own macOS/Windows-only API.
 *
 * Safe to hide even with `AppSettings.closeToTray` on: the tray/menu-bar icon (see
 * `main/tray/create-tray.ts`) is a separate, independent way back into the app, and
 * this app also honors `AppSettings.showTrayIcon` — hiding *both* at once is the
 * user's own explicit choice made across two separate settings, not something this
 * function needs to prevent; macOS itself will still relaunch/refocus the app from
 * Spotlight/Finder regardless of Dock visibility.
 */
export function applyDockIconVisibility(app: DockApp, showDockIcon: boolean): void {
  if (!app.dock) {
    return;
  }
  if (showDockIcon) {
    void app.dock.show();
  } else {
    app.dock.hide();
  }
}

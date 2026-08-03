/** The subset of Electron's `app` this module needs — kept narrow for easy testing,
 * same convention as `LastfmDataClient`/`CloseToTrayWindow` elsewhere in `main/`. */
export interface LoginItemApp {
  setLoginItemSettings(settings: { openAtLogin: boolean }): void;
}

/**
 * Registers (or unregisters) this app as an OS login item — the `main/index.ts` startup
 * call and `wire-settings.ts`'s live-update callback both go through this one function,
 * so the platform rules below are enforced in exactly one place.
 *
 * **Linux is a deliberate no-op**: verified against Electron's own current docs
 * (https://www.electronjs.org/docs/latest/api/app) that `setLoginItemSettings` has no
 * Linux support at all — calling it there wouldn't throw, but it also wouldn't do
 * anything, so skipping the call entirely is more honest than pretending it worked.
 * `AppSettings.launchAtLogin`'s docstring is why Settings → General hides this row on
 * Linux rather than presenting a control that can't do anything.
 *
 * **Deliberately never passes `openAsHidden`**: also verified against Electron's own
 * docs that it's macOS-only, explicitly marked Deprecated, and "does not work on macOS
 * 13 and up" — so `AppSettings.startMinimized` is implemented independently instead, as
 * plain `BrowserWindow` show/hide logic (`create-main-window.ts`'s `startHidden`
 * option), which behaves identically on all three platforms rather than depending on a
 * flag that doesn't work on any of them anymore.
 *
 * @param platform Injected (defaults to `process.platform`) purely for testability —
 * real callers never pass this.
 */
export function applyLoginItemSettings(
  app: LoginItemApp,
  launchAtLogin: boolean,
  platform: NodeJS.Platform = process.platform,
): void {
  if (platform === "linux") {
    return;
  }
  app.setLoginItemSettings({ openAtLogin: launchAtLogin });
}

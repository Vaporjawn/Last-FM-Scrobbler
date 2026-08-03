/**
 * Whether a newly-created main window should skip its automatic startup `.show()` (see
 * `create-main-window.ts`'s `startHidden` option) — `true` only when both
 * `AppSettings.startMinimized` is on AND this specific process launch was actually
 * triggered by the OS login item, not a manual open.
 *
 * Gating on `wasOpenedAtLogin` (from `Electron.app.getLoginItemSettings()`, verified
 * against Electron's current docs as supported on macOS/Windows and *not* deprecated —
 * unlike `wasOpenedAsHidden`/`restoreState`, which are macOS-only and deprecated, see
 * `main/login-items/apply-login-item-settings.ts`'s docstring for the sibling
 * verification on the write side of this same API) matters: without it, a user who
 * manually double-clicks the app icon with "start minimized" enabled would see nothing
 * happen and have to go find the tray/menu bar icon themselves, which reads as broken
 * rather than as the "don't pop up on a background auto-launch" behavior this setting
 * is actually for. On Linux, `wasOpenedAtLogin` is always `false` (Electron has no
 * login-item support there at all — see `applyLoginItemSettings`), so this naturally
 * always resolves to `false` there too, consistent with `launchAtLogin` itself being a
 * no-op on that platform.
 */
export function resolveStartHidden(startMinimized: boolean, wasOpenedAtLogin: boolean): boolean {
  return startMinimized && wasOpenedAtLogin;
}

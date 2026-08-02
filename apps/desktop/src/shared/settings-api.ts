/**
 * User-configurable app settings, persisted by `main/settings/settings-store.ts` and
 * exposed to the renderer via `window.settings` (see `preload/index.ts`).
 */
export interface AppSettings {
  /**
   * When `true` (the default), closing the main window hides it instead of quitting —
   * the app keeps running in the tray (Windows/Linux) or menu bar (macOS) so playback
   * tracking and scrobbling continue in the background. This is the primary way the
   * app is meant to be used day-to-day, since scrobbling only happens while it's
   * running — see `main/tray/create-tray.ts` and `main/index.ts`'s window `close`
   * handler.
   */
  readonly closeToTray: boolean;
  /**
   * When `true` (the default), the app checks GitHub Releases for a newer version on
   * launch and periodically while running, downloads any update it finds in the
   * background, and prompts before installing it — see
   * `main/updates/create-updater.ts` and docs/modules/desktop.md's "Auto-update"
   * section. Turning this off only disables the *automatic* checks — a manual "Check
   * for updates now" (Preferences → General) always works regardless.
   */
  readonly autoUpdateEnabled: boolean;
  /**
   * `true` once the one-time "Last.fm Scrobbler is still running in the tray/menu
   * bar" native notification has been shown — see `main/index.ts`'s
   * `wireCloseToTray({ onHide, ... })` wiring. Not user-facing (no Preferences
   * toggle) — this is bookkeeping, not a setting someone would choose a value for.
   */
  readonly hasShownTrayHint: boolean;
}

/** Both `closeToTray`/`autoUpdateEnabled` on by default: this app is meant to run in
 * the background, not be quit on every window close, and meant to keep itself current
 * without the user having to remember to check manually (see
 * `docs/modules/desktop.md`). `hasShownTrayHint` starts `false` — every fresh install
 * gets the one-time explanation once, the first time it actually happens. */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  closeToTray: true,
  autoUpdateEnabled: true,
  hasShownTrayHint: false,
};

/** Renderer-facing settings API — see `preload/index.ts` for the real implementation
 * and `renderer/src/hooks/use-settings.ts` for the consuming hook. */
export interface SettingsApi {
  get(): Promise<AppSettings>;
  /** Merges `patch` into the persisted settings and returns the full updated settings. */
  set(patch: Partial<AppSettings>): Promise<AppSettings>;
}

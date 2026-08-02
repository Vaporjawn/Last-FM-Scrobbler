/** The main window's size and position, as returned by `BrowserWindow.getBounds()` —
 * see `main/window/persist-window-bounds.ts` (saves it) and `main/create-main-window.ts`
 * (restores it on the next launch). */
export interface WindowBounds {
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
}

/**
 * A user-selectable resize constraint for the main window — `"free"` (the default) is
 * unconstrained resizing, same as before this setting existed; the others lock the
 * window to that width:height ratio. See `main/window/resolve-aspect-ratio.ts` for how
 * this becomes the numeric ratio `BrowserWindow.setAspectRatio()` expects.
 */
export type AspectRatioOption = "free" | "16:9" | "4:3" | "1:1";

/**
 * The app's color scheme — `"dark"` (the default, and this app's original and only
 * look before this setting existed) or `"light"`. See `renderer/src/theme/index.ts`'s
 * `createAppTheme` for both palettes.
 */
export type ThemeMode = "light" | "dark";

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
   * for updates now" (Settings → General) always works regardless.
   */
  readonly autoUpdateEnabled: boolean;
  /**
   * `true` once the one-time "Last.fm Scrobbler is still running in the tray/menu
   * bar" native notification has been shown — see `main/index.ts`'s
   * `wireCloseToTray({ onHide, ... })` wiring. Not user-facing (no Settings
   * toggle) — this is bookkeeping, not a setting someone would choose a value for.
   */
  readonly hasShownTrayHint: boolean;
  /**
   * The main window's size/position from the end of the last session — `undefined`
   * before it's ever been saved (first launch), in which case `create-main-window.ts`
   * falls back to its own built-in default (1100x720). Not user-facing (no Settings
   * toggle) — this is bookkeeping, updated automatically as the window is resized or
   * moved, not a setting someone would choose a value for. See
   * `main/window/persist-window-bounds.ts`.
   */
  readonly windowBounds?: WindowBounds;
  /**
   * The main window's resize aspect-ratio lock — `"free"` (the default) preserves the
   * unconstrained resizing this app always had before this setting existed. Settings
   * → Window offers the other options. See `main/window/resolve-aspect-ratio.ts`.
   */
  readonly aspectRatio: AspectRatioOption;
  /**
   * Light or dark color scheme — Settings → General offers both. See
   * `renderer/src/theme/index.ts`'s `createAppTheme`.
   */
  readonly themeMode: ThemeMode;
}

/** `closeToTray`/`autoUpdateEnabled` on by default: this app is meant to run in the
 * background, not be quit on every window close, and meant to keep itself current
 * without the user having to remember to check manually (see
 * `docs/modules/desktop.md`). `hasShownTrayHint` starts `false` — every fresh install
 * gets the one-time explanation once, the first time it actually happens.
 * `windowBounds` starts unset — nothing to restore until a real session saves one.
 * `aspectRatio` starts `"free"` — preserves this app's original unconstrained-resize
 * behavior for anyone who never visits the new setting. `themeMode` starts `"dark"` —
 * this app's original and only look before this setting existed, so anyone who never
 * visits Settings sees no visual change. */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  closeToTray: true,
  autoUpdateEnabled: true,
  hasShownTrayHint: false,
  aspectRatio: "free",
  themeMode: "dark",
};

/** Renderer-facing settings API — see `preload/index.ts` for the real implementation
 * and `renderer/src/hooks/use-settings.ts` for the consuming hook. */
export interface SettingsApi {
  get(): Promise<AppSettings>;
  /** Merges `patch` into the persisted settings and returns the full updated settings. */
  set(patch: Partial<AppSettings>): Promise<AppSettings>;
}

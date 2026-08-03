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
  /**
   * When `true` (the default — an opt-out, not an opt-in, so nobody already relying on
   * this notification silently loses it), a native "Scrobbled: …" notification fires
   * every time a batch of scrobbles is accepted by Last.fm — see
   * `main/scrobbling/wire-scrobbling.ts`'s `onScrobbled` and `main/index.ts`'s use of
   * it. Read fresh from the settings store on every notification (not captured once at
   * startup), so toggling this takes effect immediately, no restart needed.
   */
  readonly notifyOnScrobble: boolean;
  /**
   * When `true` (the default, same opt-out reasoning as `notifyOnScrobble`), a native
   * notification fires once submission has failed `FAILURE_NOTIFICATION_THRESHOLD`
   * consecutive drain cycles in a row — see `main/scrobbling/wire-scrobbling.ts`'s
   * `onScrobbleFailed`. Also read fresh on every notification, same as
   * `notifyOnScrobble`.
   */
  readonly notifyOnScrobbleFailure: boolean;
  /**
   * When `true` (default `false` — an opt-in, since this app never touched OS login
   * items before this setting existed, so nobody sees new behavior unless they turn it
   * on), the app registers itself as a login item via
   * `app.setLoginItemSettings({ openAtLogin: true })` once at startup, and live-updates
   * the registration whenever this setting changes — see `main/index.ts` and
   * `main/settings/wire-settings.ts`'s `onLaunchAtLoginChange`. **Electron has no Linux
   * support for `setLoginItemSettings` at all** (verified against
   * https://www.electronjs.org/docs/latest/api/app: the API is documented as
   * macOS/Windows/MAS only) — calling it on Linux is simply a no-op, so Settings →
   * General hides this row on Linux rather than presenting a control that can't do
   * anything.
   */
  readonly launchAtLogin: boolean;
  /**
   * When `true` (default `false`, same opt-in reasoning as `launchAtLogin`, and only
   * meaningful once `launchAtLogin` is also on), a login-triggered launch leaves the
   * main window hidden instead of showing it immediately — see
   * `main/window/create-main-window.ts`'s `startHidden` option and `main/index.ts`.
   * **Deliberately does not rely on `setLoginItemSettings`'s `openAsHidden` option**:
   * verified against Electron's own current docs that `openAsHidden` is (a)
   * macOS-only, (b) explicitly marked Deprecated, and (c) "does not work on macOS 13
   * and up" — so it can't be trusted on any modern Mac, and was never supported on
   * Windows/Linux to begin with. This setting is implemented instead as plain
   * `BrowserWindow` show/hide logic this app already fully controls, which behaves
   * identically on all three platforms. Live-verified from this (macOS) sandbox only —
   * the Windows/Linux paths use the same documented, platform-uniform
   * `BrowserWindow`/`ready-to-show` APIs but are unverified here; see this project's
   * CLAUDE.md on that sandbox limitation.
   */
  readonly startMinimized: boolean;
  /**
   * A `packages/core` filter-DSL expression (see `compileFilter`'s docstring for the
   * grammar — fields `artist`/`title`/`album`/`albumArtist`/`durationSec`/`sourceApp`,
   * operators `==`/`!=`/`contains`/`matches`/`<`/`>`/etc., combined with `and`/`or`/
   * `not`) — a track matching it is excluded entirely: no "now playing" update, no
   * scrobble. `undefined`/empty means no filtering, this app's original and only
   * behavior before this setting existed. Applied once at startup (see
   * `main/index.ts`'s `createAndWireMainWindow`) — unlike the live-updating settings
   * above, a change here needs an app restart to take effect (`Tracker`, in
   * `packages/core`, has no way to swap its filter after construction); Settings →
   * Filter says so explicitly when this is saved. An expression that fails to compile
   * (`FilterSyntaxError`) is treated as no filter at all, logged as a warning, rather
   * than crashing the tracker — see `main/index.ts`. Typed as `string | undefined`
   * (not just `string?`) despite `exactOptionalPropertyTypes`: Settings → Filter needs
   * to explicitly send `{ filterExpression: undefined }` to *clear* a previously-saved
   * expression back to "no filter" — `set()`'s merge semantics mean omitting the key
   * entirely would leave the old value untouched instead.
   */
  readonly filterExpression?: string | undefined;
  /**
   * When `true` (the default), the app's Dock icon is visible on macOS — turning this
   * off calls `app.dock.hide()` (see `main/dock/apply-dock-icon-visibility.ts`), the
   * same "run from the tray/menu bar only" pattern the reference Last.fm desktop
   * client itself offers. A no-op on Windows/Linux, which have no Dock concept at all
   * (`app.dock` is `undefined` there) — Settings → General hides this row outside
   * macOS rather than presenting a control that can't do anything. Live-updates the
   * already-running app immediately, no restart needed — unlike `showTrayIcon` below,
   * showing/hiding the Dock icon has no lifecycle to manage (no window/menu tied to
   * it), so there's nothing a live update could get wrong.
   */
  readonly showDockIcon: boolean;
  /**
   * When `true` (the default), the tray/menu-bar icon (see `main/tray/create-tray.ts`)
   * is created at startup — turning this off skips creating it. **Applied once at
   * startup only, not live-updated**: unlike `showDockIcon` above, the tray icon owns
   * real lifecycle (its context menu, the mini-player popover it toggles, being the
   * thing `AppSettings.closeToTray` relies on to reopen a hidden window) that a live
   * destroy/recreate would need to coordinate correctly with everything else already
   * holding a reference to it; Settings → General says so explicitly ("restart to take
   * effect") rather than silently doing nothing until the next launch. Turning this off
   * while `closeToTray` is also on means closing the window leaves the app reachable
   * only via the Dock icon (macOS) or by relaunching it — a combination this app
   * allows (it's the user's own explicit choice across two settings) rather than
   * blocking.
   */
  readonly showTrayIcon: boolean;
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
 * visits Settings sees no visual change. `notifyOnScrobble`/`notifyOnScrobbleFailure`
 * start `true` — this app always fired both notifications unconditionally before these
 * settings existed, so anyone who never visits the new toggles sees no behavior
 * change. `launchAtLogin`/`startMinimized` start `false` — this app never registered
 * itself as a login item before these settings existed, so anyone who never visits the
 * new toggles sees no behavior change. `showDockIcon`/`showTrayIcon` start `true` —
 * this app always showed both before these settings existed, so anyone who never
 * visits the new toggles sees no visual change. */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  closeToTray: true,
  autoUpdateEnabled: true,
  hasShownTrayHint: false,
  aspectRatio: "free",
  themeMode: "dark",
  notifyOnScrobble: true,
  notifyOnScrobbleFailure: true,
  launchAtLogin: false,
  startMinimized: false,
  showDockIcon: true,
  showTrayIcon: true,
};

/** Renderer-facing settings API — see `preload/index.ts` for the real implementation,
 * `renderer/src/hooks/use-settings-state.ts` for the state-holding hook, and
 * `renderer/src/contexts/settings-context.ts` for the shared hook most components
 * should actually call. */
export interface SettingsApi {
  get(): Promise<AppSettings>;
  /** Merges `patch` into the persisted settings and returns the full updated settings. */
  set(patch: Partial<AppSettings>): Promise<AppSettings>;
  /** Replaces all persisted settings with their defaults and returns them — see
   * `SettingsStore.reset()`'s docstring for why this is a distinct operation from
   * `set()` rather than `set(DEFAULT_APP_SETTINGS)`. */
  reset(): Promise<AppSettings>;
}

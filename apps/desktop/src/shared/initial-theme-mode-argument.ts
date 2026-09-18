import type { ThemeMode } from "./settings-api.js";

/**
 * The `--initial-theme-mode=<mode>` flag's prefix — shared between
 * `buildInitialThemeModeArgument` (the write side, called from
 * `main/create-main-window.ts`) and `resolveThemeModeFromArgv` (the read side, called
 * from `preload/index.ts`) below, so the two sides can't silently drift apart if the
 * flag's name ever changes.
 */
const INITIAL_THEME_MODE_ARGUMENT_PREFIX = "--initial-theme-mode=";

/**
 * Builds the `webPreferences.additionalArguments` entry `create-main-window.ts` passes
 * when constructing the main `BrowserWindow` — Electron appends this string to
 * `process.argv` in that window's renderer process, which is how the persisted
 * `AppSettings.themeMode` (read synchronously from `SettingsStore` in the main
 * process, before the `BrowserWindow` is even constructed) reaches `preload/index.ts`
 * before any of the page's own content loads. See `resolveThemeModeFromArgv` for the
 * read side, and `renderer/index.html`/`renderer/public/theme-init.js` for why this
 * needs to be available that early: closing the flash of the wrong theme a light-mode
 * user used to see on every launch, before React ever mounted and swapped in the real
 * MUI theme.
 */
export function buildInitialThemeModeArgument(mode: ThemeMode): string {
  return `${INITIAL_THEME_MODE_ARGUMENT_PREFIX}${mode}`;
}

/**
 * Reads the `--initial-theme-mode=<mode>` flag back out of the renderer process's
 * `process.argv` (see `buildInitialThemeModeArgument` above for how it gets there) —
 * called once, synchronously, at the top of `preload/index.ts`, which exposes the
 * result as `window.initialThemeMode` for `renderer/public/theme-init.js` to read.
 * Falls back to `"dark"` — `DEFAULT_APP_SETTINGS.themeMode`'s own value, and this
 * app's original look — whenever the flag is missing entirely (e.g. the tray popover
 * window, which loads this exact same renderer bundle but doesn't pass this flag —
 * see `main/tray/create-tray-popover-window.ts`) or carries an unrecognized value.
 */
export function resolveThemeModeFromArgv(argv: readonly string[]): ThemeMode {
  const flag = argv.find((arg) => arg.startsWith(INITIAL_THEME_MODE_ARGUMENT_PREFIX));
  const value = flag?.slice(INITIAL_THEME_MODE_ARGUMENT_PREFIX.length);
  return value === "light" ? "light" : "dark";
}

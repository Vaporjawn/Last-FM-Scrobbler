import type { ThemeMode } from "./settings-api.js";
import { INITIAL_THEME_MODE_ARGUMENT_PREFIX } from "./initial-theme-mode-argument-prefix.js";

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

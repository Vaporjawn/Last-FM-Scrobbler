import type { ThemeMode } from "./settings-api.js";
import { INITIAL_THEME_MODE_ARGUMENT_PREFIX } from "./initial-theme-mode-argument-prefix.js";

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

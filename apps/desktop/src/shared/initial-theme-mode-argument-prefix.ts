/**
 * The `--initial-theme-mode=<mode>` flag's prefix — shared between
 * `buildInitialThemeModeArgument` (the write side, called from
 * `main/create-main-window.ts`) and `resolveThemeModeFromArgv` (the read side, called
 * from `preload/index.ts`) below, so the two sides can't silently drift apart if the
 * flag's name ever changes.
 */
export const INITIAL_THEME_MODE_ARGUMENT_PREFIX = "--initial-theme-mode=";

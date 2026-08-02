import { createContext, useContext } from "react";
import { DEFAULT_APP_SETTINGS } from "../../../shared/settings-api.js";
import { fail } from "../hooks/action-result.js";
import type { UseSettingsResult } from "../hooks/use-settings-state.js";

export const SettingsContext = createContext<UseSettingsResult | undefined>(undefined);

const NOT_AVAILABLE = "Not available right now.";

const NO_PROVIDER_SETTINGS: UseSettingsResult = {
  settings: DEFAULT_APP_SETTINGS,
  loading: false,
  error: undefined,
  updateSettings: () => Promise.resolve(fail(NOT_AVAILABLE)),
};

/**
 * Reads the app-wide settings context (see `SettingsProvider`, mounted once in
 * `App.tsx` around everything except `TrayPopover` — a genuinely separate renderer
 * window that calls `useSettingsState()` directly instead, since there's no React
 * tree to share a context through across a window boundary). Returns
 * `DEFAULT_APP_SETTINGS` and a no-op, always-failing `updateSettings` — never
 * throws — when no `SettingsProvider` is an ancestor, matching this codebase's
 * established `useAuth`/`useSnackbar`/etc. "degrade gracefully when the surrounding
 * context isn't present" convention (component tests that render a single page in
 * isolation, for one).
 *
 * Every component that reads or writes `AppSettings` inside the main app should call
 * *this* hook, not `useSettingsState` directly — see that hook's own docstring for
 * why calling it more than once creates unsynchronized, silently-diverging copies of
 * the same settings.
 */
export function useSettings(): UseSettingsResult {
  return useContext(SettingsContext) ?? NO_PROVIDER_SETTINGS;
}

import type { JSX, ReactNode } from "react";
import { useSettingsState } from "../hooks/use-settings-state.js";
import { SettingsContext } from "./settings-context.js";

export interface SettingsProviderProps {
  readonly children: ReactNode;
}

/**
 * Mounted once in `App.tsx`, wrapping everything that needs live `AppSettings` —
 * `useSettingsState()`'s one and only call site in the main app's React tree (see its
 * own docstring for why calling it more than once is the actual bug this provider
 * exists to fix). Every descendant reads/writes through `useSettings()`
 * (`settings-context.ts`) instead, all sharing this one real state, so a change made
 * anywhere — the Settings page's own toggles, in particular — is immediately visible
 * everywhere else, including `App.tsx`'s own `ThemeProvider`.
 */
export function SettingsProvider({ children }: SettingsProviderProps): JSX.Element {
  const settingsState = useSettingsState();

  return <SettingsContext.Provider value={settingsState}>{children}</SettingsContext.Provider>;
}

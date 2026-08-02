import { useCallback, useEffect, useState } from "react";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../../../shared/settings-api.js";
import { fail, ok, type ActionResult } from "./action-result.js";

export interface UseSettingsResult {
  readonly settings: AppSettings;
  /** `true` until the initial `window.settings.get()` resolves — lets the UI avoid a
   * flash from the default value to the real persisted one. */
  readonly loading: boolean;
  readonly error: string | undefined;
  /** Merges `patch` into the persisted settings. Applies optimistically to `settings`
   * so a toggle feels instant, then reconciles with whatever main actually persisted —
   * or, if the underlying `window.settings.set()` call fails, rolls the optimistic
   * change back and reports the failure (via `error` and the returned `ActionResult`)
   * rather than leaving the UI showing a value that was never actually saved. */
  readonly updateSettings: (patch: Partial<AppSettings>) => Promise<ActionResult>;
}

const NOT_AVAILABLE = "Not available right now.";

/**
 * Reads/writes `AppSettings` via `window.settings` (see `shared/settings-api.ts`).
 * Returns `DEFAULT_APP_SETTINGS` and a no-op `updateSettings` — never throws — when
 * `window.settings` isn't present, which is expected outside a real Electron renderer
 * (e.g. component tests).
 */
export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!window.settings) {
      setLoading(false);
      return;
    }
    void window.settings
      .get()
      .then(setSettings)
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>): Promise<ActionResult> => {
    let previous: AppSettings | undefined;
    setSettings((current) => {
      previous = current;
      return { ...current, ...patch };
    });
    if (!window.settings) {
      return fail(NOT_AVAILABLE);
    }
    try {
      const updated = await window.settings.set(patch);
      setSettings(updated);
      setError(undefined);
      return ok();
    } catch (updateError) {
      // The optimistic update above never actually persisted — revert to what was
      // there before this call, rather than leaving the UI showing an unsaved value.
      if (previous) {
        setSettings(previous);
      }
      const result = fail(updateError);
      setError(result.error);
      return result;
    }
  }, []);

  return { settings, loading, error, updateSettings };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../../../shared/settings-api.js";
import type { ActionResult } from "./action-result.js";
import { fail } from "./fail.js";
import { ok } from "./ok.js";

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
  /** Replaces every persisted setting with its default — same optimistic-then-
   * reconcile-or-rollback treatment as `updateSettings`, see `SettingsStore.reset()`'s
   * docstring for why this is a distinct operation rather than
   * `updateSettings(DEFAULT_APP_SETTINGS)`. */
  readonly resetSettings: () => Promise<ActionResult>;
}

const NOT_AVAILABLE = "Not available right now.";

/**
 * Reads/writes `AppSettings` via `window.settings` (see `shared/settings-api.ts`).
 * Returns `DEFAULT_APP_SETTINGS` and a no-op `updateSettings` — never throws — when
 * `window.settings` isn't present, which is expected outside a real Electron renderer
 * (e.g. component tests).
 *
 * This is the *state-holding* implementation — call it exactly once. Inside the main
 * app's own React tree, that one call lives in `SettingsProvider` (see
 * `contexts/settings-context.ts`'s `useSettings()` for the context-consuming hook
 * every other component should actually call instead): `App.tsx` and `SettingsPage`
 * each calling this hook directly used to create two entirely separate, unsynchronized
 * copies of `AppSettings` state — toggling dark mode in Settings updated *its own*
 * copy and persisted correctly, but `App.tsx`'s own separate copy (the one actually
 * driving `createAppTheme`) never found out, so the theme never visibly changed until
 * a full restart re-fetched it fresh. `TrayPopover.tsx` is the one legitimate
 * exception — a genuinely separate renderer window/React tree that can't share
 * context with the main app's at all, so it calls this hook directly too, accepting
 * that it only ever sees a fresh snapshot from whenever it was last shown, not live
 * updates while it's invisible.
 */
export function useSettingsState(): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  // Bumped by both updateSettings/resetSettings on every call, and checked before
  // either applies its resolved response — same generation-ref pattern
  // use-lastfm-fetch.ts already uses for stale-response protection. Without this, two
  // concurrent calls with *different* patches (e.g. toggling dark mode, then — before
  // that IPC round trip resolves — toggling "show notifications") could apply their
  // responses out of order: main's synchronous settingsSet handler processes them in
  // call order, but nothing guaranteed *this* hook's setSettings(updated) calls landed
  // in that same order, so the earlier call's (now-stale) response could momentarily
  // overwrite the later call's correct one — self-correcting once the later response
  // also lands, but a real, visible flicker in between.
  const settingsGenerationRef = useRef(0);

  useEffect(() => {
    if (!window.settings) {
      setLoading(false);
      return;
    }
    // `cancelled` mirrors every other data-fetching hook in this codebase (see e.g.
    // use-app-version.ts) — this hook's own call sites (SettingsProvider, mounted for
    // the app's lifetime; TrayPopover, a persistent separate window) are unlikely to
    // unmount mid-fetch today, but it's a real deviation from the established
    // convention that would surface a "setState on unmounted component" issue if
    // either ever did.
    let cancelled = false;
    window.settings
      .get()
      .then((result) => {
        if (!cancelled) {
          setSettings(result);
        }
      })
      .catch((getError: unknown) => {
        // Previously uncaught: a rejected window.settings.get() (e.g. a stale
        // preload build during development — see use-auth.ts's docstring for the
        // same class of failure) surfaced only as an unhandled promise rejection.
        // `settings` silently stayed at DEFAULT_APP_SETTINGS with no way for a
        // consumer to tell "checked and failed" apart from "still loading" or
        // "genuinely has no saved settings" — this hook's own `error` field exists
        // specifically to distinguish that, same as every sibling hook already does.
        if (!cancelled) {
          setError(fail(getError).error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
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
    const myGeneration = (settingsGenerationRef.current += 1);
    try {
      const updated = await window.settings.set(patch);
      // Only apply if no newer updateSettings/resetSettings call has started since —
      // see settingsGenerationRef's own docstring for the concurrent-calls race this
      // guards against. The returned ActionResult below still always reflects this
      // call's own real outcome regardless of generation — only the shared `settings`
      // state is guarded, not what's reported back to this specific caller.
      if (settingsGenerationRef.current === myGeneration) {
        setSettings(updated);
        setError(undefined);
      }
      return ok();
    } catch (updateError) {
      // The optimistic update above never actually persisted — revert to what was
      // there before this call, rather than leaving the UI showing an unsaved value.
      // Same generation guard as the success path: don't roll back over a newer
      // call's own (possibly already-applied) result.
      if (settingsGenerationRef.current === myGeneration && previous) {
        setSettings(previous);
      }
      const result = fail(updateError);
      setError(result.error);
      return result;
    }
  }, []);

  const resetSettings = useCallback(async (): Promise<ActionResult> => {
    let previous: AppSettings | undefined;
    setSettings((current) => {
      previous = current;
      return DEFAULT_APP_SETTINGS;
    });
    if (!window.settings) {
      return fail(NOT_AVAILABLE);
    }
    // Shares the same generation counter as updateSettings — resetSettings and
    // updateSettings racing each other is the same class of concern as two
    // updateSettings calls racing each other, so both need to be ordered against one
    // another, not just against calls of their own kind.
    const myGeneration = (settingsGenerationRef.current += 1);
    try {
      const reset = await window.settings.reset();
      if (settingsGenerationRef.current === myGeneration) {
        setSettings(reset);
        setError(undefined);
      }
      return ok();
    } catch (resetError) {
      if (settingsGenerationRef.current === myGeneration && previous) {
        setSettings(previous);
      }
      const result = fail(resetError);
      setError(result.error);
      return result;
    }
  }, []);

  return { settings, loading, error, updateSettings, resetSettings };
}

import { isAspectRatioOption } from "../../shared/is-aspect-ratio-option.js";
import { type AppSettings } from "../../shared/settings-api.js";
import { parseWindowBounds } from "./parse-window-bounds.js";

/** Longest filter expression kept. Real expressions are a line or two; this only stops a
 * runaway value (a corrupted file, a hostile caller) from being stored and recompiled on
 * every launch. */
const MAX_FILTER_EXPRESSION_LENGTH = 2_000;
const BOOLEAN_KEYS = [
  "closeToTray",
  "autoUpdateEnabled",
  "hasShownTrayHint",
  "notifyOnScrobble",
  "notifyOnScrobbleFailure",
  "launchAtLogin",
  "startMinimized",
  "scrobblingEnabled",
  "skipNonMusicVideos",
  "showDockIcon",
  "showTrayIcon",
] as const satisfies readonly (keyof AppSettings)[];
/** Every setting the app defines. Typed as a complete `Record`, so adding a setting to
 * `AppSettings` without deciding how it is validated here fails to compile instead of
 * silently making that setting un-saveable. */
const SETTING_KEYS: Record<keyof AppSettings, true> = {
  closeToTray: true,
  autoUpdateEnabled: true,
  hasShownTrayHint: true,
  notifyOnScrobble: true,
  notifyOnScrobbleFailure: true,
  launchAtLogin: true,
  startMinimized: true,
  scrobblingEnabled: true,
  skipNonMusicVideos: true,
  showDockIcon: true,
  showTrayIcon: true,
  aspectRatio: true,
  themeMode: true,
  filterExpression: true,
  windowBounds: true,
};
const KNOWN_KEYS: ReadonlySet<string> = new Set(Object.keys(SETTING_KEYS));
export interface SanitizedSettings {
  /** Only the known settings whose values have the right type and range. */
  readonly accepted: Partial<AppSettings>;
  /** Every key that was dropped: unknown, or a known one with a bad value. */
  readonly rejectedKeys: readonly string[];
}
/**
 * Reduces `raw` — the parsed `settings.json`, or the patch a renderer sent over IPC — to
 * the settings this app actually defines, with the right types and sane ranges. Both
 * sources are untrusted input: the file can be hand-edited or corrupted, and the
 * renderer is a web page. Before this, a patch was merged into the stored settings as is,
 * so an unknown key was persisted forever, a string where a boolean belongs flowed on
 * into code that trusts the type, and an absurd window size reached the window manager.
 */
export function sanitizeSettings(raw: unknown): SanitizedSettings {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { accepted: {}, rejectedKeys: [] };
  }

  const input = raw as Record<string, unknown>;
  const accepted: Record<string, unknown> = {};
  const rejectedKeys: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (!KNOWN_KEYS.has(key)) {
      rejectedKeys.push(key);
    } else if ((BOOLEAN_KEYS as readonly string[]).includes(key)) {
      if (typeof value === "boolean") {
        accepted[key] = value;
      } else {
        rejectedKeys.push(key);
      }
    } else if (key === "aspectRatio") {
      if (isAspectRatioOption(value)) {
        accepted[key] = value;
      } else {
        rejectedKeys.push(key);
      }
    } else if (key === "themeMode") {
      if (value === "light" || value === "dark") {
        accepted[key] = value;
      } else {
        rejectedKeys.push(key);
      }
    } else if (key === "filterExpression") {
      // `undefined` (or `null` from JSON) is how the UI clears a saved filter.
      if (value === undefined || value === null) {
        accepted[key] = undefined;
      } else if (typeof value === "string" && value.length <= MAX_FILTER_EXPRESSION_LENGTH) {
        accepted[key] = value;
      } else {
        rejectedKeys.push(key);
      }
    } else {
      const bounds = parseWindowBounds(value);
      if (bounds) {
        accepted[key] = bounds;
      } else {
        rejectedKeys.push(key);
      }
    }
  }

  return { accepted, rejectedKeys };
}

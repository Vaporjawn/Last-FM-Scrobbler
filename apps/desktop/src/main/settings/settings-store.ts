import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../../shared/settings-api.js";

export interface SettingsStoreOptions {
  /** Where to persist settings as JSON, e.g. `app.getPath("userData")/settings.json`. */
  readonly filePath: string;
}

export interface SettingsStore {
  get(): AppSettings;
  /** Merges `patch` into the persisted settings, writes it to disk, and returns the
   * full updated settings. */
  set(patch: Partial<AppSettings>): AppSettings;
  /** Replaces the persisted settings with `DEFAULT_APP_SETTINGS` entirely and returns
   * them. Deliberately **not** implemented as `set(DEFAULT_APP_SETTINGS)`: `set()`'s
   * merge semantics (`{ ...current, ...patch }`) only overwrite keys the patch
   * actually contains, and `DEFAULT_APP_SETTINGS` has no key at all for optional
   * fields like `windowBounds`/`filterExpression` (they're correctly omitted, not set
   * to `undefined`) — spreading it as a patch would silently leave a previously-saved
   * value for either sitting untouched instead of actually resetting it. This writes
   * the defaults directly as the file's entire new contents instead, so optional
   * fields genuinely go back to "unset". */
  reset(): AppSettings;
}

/**
 * Persists user-configurable settings (see `shared/settings-api.ts`) as a plain JSON
 * file — unlike `ElectronSecretStorage`, nothing here is sensitive, so no encryption is
 * involved. The file is the source of truth and is re-read on every `get()`, mirroring
 * `ElectronSecretStorage`'s approach; settings reads/writes are infrequent (Settings
 * toggles, app startup), so there's no need for an in-memory cache.
 */
export function createSettingsStore(options: SettingsStoreOptions): SettingsStore {
  const { filePath } = options;

  function readSettings(): AppSettings {
    if (!existsSync(filePath)) {
      return { ...DEFAULT_APP_SETTINGS };
    }
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<AppSettings>;
      return { ...DEFAULT_APP_SETTINGS, ...parsed };
    } catch {
      // A corrupt or unreadable settings file must never block app startup — fall back
      // to defaults rather than throwing (the next set() call will overwrite it with a
      // valid file).
      return { ...DEFAULT_APP_SETTINGS };
    }
  }

  function writeSettings(settings: AppSettings): void {
    // Same owner-only-permissions treatment as `ElectronSecretStorage`'s writeFile —
    // this file holds no secrets, but there's no reason to leave it more permissive
    // than that on a shared/multi-user machine either. `chmodSync` after the write
    // (not just `mode` on mkdirSync/writeFileSync, which only applies at creation)
    // tightens permissions even on a file left over from before this hardening.
    mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
    writeFileSync(filePath, JSON.stringify(settings, null, 2), { encoding: "utf8", mode: 0o600 });
    chmodSync(filePath, 0o600);
  }

  return {
    get: readSettings,
    set(patch) {
      const updated = { ...readSettings(), ...patch };
      writeSettings(updated);
      return updated;
    },
    reset() {
      const defaults = { ...DEFAULT_APP_SETTINGS };
      writeSettings(defaults);
      return defaults;
    },
  };
}

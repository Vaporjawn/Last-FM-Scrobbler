import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
}

/**
 * Persists user-configurable settings (see `shared/settings-api.ts`) as a plain JSON
 * file — unlike `ElectronSecretStorage`, nothing here is sensitive, so no encryption is
 * involved. The file is the source of truth and is re-read on every `get()`, mirroring
 * `ElectronSecretStorage`'s approach; settings reads/writes are infrequent (Preferences
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
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf8");
  }

  return {
    get: readSettings,
    set(patch) {
      const updated = { ...readSettings(), ...patch };
      writeSettings(updated);
      return updated;
    },
  };
}

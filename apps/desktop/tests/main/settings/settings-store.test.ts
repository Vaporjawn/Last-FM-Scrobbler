import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSettingsStore } from "../../../src/main/settings/settings-store.js";
import { DEFAULT_APP_SETTINGS } from "../../../src/shared/settings-api.js";

describe("createSettingsStore", () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "settings-store-test-"));
    filePath = join(dir, "settings.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns the full defaults when no settings file exists yet", () => {
    const store = createSettingsStore({ filePath });

    expect(store.get()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("set() persists a patch and returns the full updated settings", () => {
    const store = createSettingsStore({ filePath });

    const result = store.set({ closeToTray: false });

    expect(result).toMatchObject({ closeToTray: false });
    expect(store.get()).toMatchObject({ closeToTray: false });
  });

  it("persists across separate createSettingsStore calls against the same file", () => {
    const first = createSettingsStore({ filePath });
    first.set({ closeToTray: false });

    const second = createSettingsStore({ filePath });

    expect(second.get()).toMatchObject({ closeToTray: false });
  });

  it("set() merges a partial patch rather than replacing the whole settings object", () => {
    writeFileSync(filePath, JSON.stringify({ closeToTray: false, futureField: "kept" }), "utf8");
    const store = createSettingsStore({ filePath });

    // Patching an unrelated field (once one exists) must not clobber closeToTray.
    const result = store.set({});

    expect(result).toMatchObject({ closeToTray: false });
  });

  it("falls back to defaults rather than throwing when the settings file has invalid JSON", () => {
    writeFileSync(filePath, "{ not valid json", "utf8");
    const store = createSettingsStore({ filePath });

    expect(store.get()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("creates the parent directory on first write if it doesn't exist yet", () => {
    const nestedPath = join(dir, "nested", "settings.json");
    const store = createSettingsStore({ filePath: nestedPath });

    store.set({ closeToTray: false });

    expect(JSON.parse(readFileSync(nestedPath, "utf8"))).toMatchObject({ closeToTray: false });
  });
});

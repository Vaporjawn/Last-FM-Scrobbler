import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
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

  it("reset() restores the full defaults and returns them", () => {
    const store = createSettingsStore({ filePath });
    store.set({ closeToTray: false, themeMode: "light" });

    const result = store.reset();

    expect(result).toEqual(DEFAULT_APP_SETTINGS);
    expect(store.get()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("reset() actually clears optional fields set() would leave behind, unlike set(DEFAULT_APP_SETTINGS)", () => {
    // The whole reason reset() exists as its own method rather than
    // `store.set(DEFAULT_APP_SETTINGS)`: set()'s merge semantics
    // (`{ ...current, ...patch }`) only ever overwrite keys the patch actually
    // contains. DEFAULT_APP_SETTINGS has no windowBounds/filterExpression key at all
    // (they're optional, correctly omitted), so spreading it as a patch would leave a
    // previously-saved value for either sitting untouched — reset() must instead
    // write the defaults directly, replacing the file's entire contents.
    writeFileSync(
      filePath,
      JSON.stringify({ windowBounds: { width: 900, height: 600, x: 0, y: 0 } }),
      "utf8",
    );
    const store = createSettingsStore({ filePath });
    expect(store.get()).toMatchObject({ windowBounds: { width: 900, height: 600, x: 0, y: 0 } });

    const result = store.reset();

    expect(result.windowBounds).toBeUndefined();
    expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("reset() persists across separate createSettingsStore calls against the same file", () => {
    const first = createSettingsStore({ filePath });
    first.set({ closeToTray: false });
    first.reset();

    const second = createSettingsStore({ filePath });

    expect(second.get()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("writes atomically — the real file always has complete, valid content, and no temp file is left behind", () => {
    // Regression test: writeSettings used to write directly to the target path with
    // no temp-file-then-rename. A process killed mid-write could leave settings.json
    // truncated/invalid — silently losing every persisted setting on the next read
    // (readSettings falls back to defaults with no user-visible warning). This can't
    // directly simulate a kill mid-write, but it does verify the write path actually
    // goes through a temp file that gets cleaned up via rename, not left dangling —
    // the mechanism that makes the write atomic in the first place.
    const store = createSettingsStore({ filePath });

    store.set({ closeToTray: false });

    expect(JSON.parse(readFileSync(filePath, "utf8"))).toMatchObject({ closeToTray: false });
    expect(existsSync(`${filePath}.tmp`)).toBe(false);
    // Only the real settings.json should exist in the directory — no leftover temp
    // file from the rename.
    expect(readdirSync(dir)).toEqual(["settings.json"]);
  });

  // Mode bits aren't meaningful on Windows the way they are on POSIX systems — skip
  // there, matching the same platform-specific skip used for this exact assertion in
  // tests/main/secret-storage/electron-secret-storage.test.ts.
  it.skipIf(process.platform === "win32")(
    "restricts settings.json to owner-only read/write (0o600), even on an existing file with looser permissions",
    () => {
      const store = createSettingsStore({ filePath });
      store.set({ closeToTray: false });
      // Simulate a file left over from before this fix, with the old (looser)
      // default permissions — set() must tighten these on every write.
      chmodSync(filePath, 0o644);

      store.set({ autoUpdateEnabled: false });

      const mode = statSync(filePath).mode & 0o777;
      expect(mode).toBe(0o600);
    },
  );
});

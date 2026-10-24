import { describe, expect, it } from "vitest";
import { sanitizeSettings } from "../../../src/main/settings/sanitize-settings.js";

describe("sanitizeSettings", () => {
  it("keeps every valid setting", () => {
    const valid = {
      closeToTray: false,
      autoUpdateEnabled: true,
      hasShownTrayHint: true,
      notifyOnScrobble: false,
      notifyOnScrobbleFailure: false,
      launchAtLogin: true,
      startMinimized: true,
      scrobblingEnabled: false,
      skipNonMusicVideos: true,
      showDockIcon: false,
      showTrayIcon: false,
      aspectRatio: "16:9",
      themeMode: "light",
      filterExpression: 'sourceApp == "x"',
      windowBounds: { x: -20, y: 40, width: 900, height: 600 },
    };

    expect(sanitizeSettings(valid)).toEqual({ accepted: valid, rejectedKeys: [] });
  });

  it.each([[null], [undefined], ["text"], [42], [["closeToTray"]]])(
    "accepts nothing from %j, which is not an object",
    (raw) => {
      expect(sanitizeSettings(raw)).toEqual({ accepted: {}, rejectedKeys: [] });
    },
  );

  it("drops unknown keys, including prototype-style ones, and reports them", () => {
    const hostile: unknown = JSON.parse(
      '{"__proto__": {"polluted": true}, "extra": 1, "closeToTray": true}',
    );

    const result = sanitizeSettings(hostile);

    expect(result.accepted).toEqual({ closeToTray: true });
    expect(result.rejectedKeys).toEqual(["__proto__", "extra"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each([
    ["closeToTray", "yes"],
    ["showTrayIcon", 1],
    ["aspectRatio", "21:9"],
    ["themeMode", "sepia"],
    ["filterExpression", 42],
    ["filterExpression", "x".repeat(2_001)],
    ["windowBounds", "big"],
    ["windowBounds", null],
    ["windowBounds", { x: 0, y: 0, width: 0, height: 100 }],
    ["windowBounds", { x: 0, y: 0, width: 100, height: -5 }],
    ["windowBounds", { x: 0.5, y: 0, width: 100, height: 100 }],
    ["windowBounds", { x: 0, y: 0, width: 1e9, height: 100 }],
    ["windowBounds", { x: 1e9, y: 0, width: 100, height: 100 }],
    ["windowBounds", { x: 0, y: 0, width: Number.NaN, height: 100 }],
    ["windowBounds", { x: 0, y: 0, width: 100 }],
  ])("rejects a bad value for %s: %j", (key, value) => {
    const result = sanitizeSettings({ [key]: value });

    expect(result.accepted).toEqual({});
    expect(result.rejectedKeys).toEqual([key]);
  });

  it("treats an undefined or null filterExpression as the request to clear it", () => {
    expect(sanitizeSettings({ filterExpression: undefined }).accepted).toHaveProperty(
      "filterExpression",
      undefined,
    );
    expect(sanitizeSettings({ filterExpression: null }).accepted).toHaveProperty(
      "filterExpression",
      undefined,
    );
  });

  it("accepts a filterExpression of exactly the maximum length", () => {
    const limit = "x".repeat(2_000);

    expect(sanitizeSettings({ filterExpression: limit }).accepted).toEqual({
      filterExpression: limit,
    });
  });
});

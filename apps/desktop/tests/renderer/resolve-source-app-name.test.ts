import { describe, expect, it } from "vitest";
import { resolveSourceAppName } from "../../src/renderer/src/utils/resolve-source-app-name.js";

describe("resolveSourceAppName", () => {
  it("maps a known bundle id to a friendly name", () => {
    expect(resolveSourceAppName("com.apple.Music")).toBe("Apple Music");
    expect(resolveSourceAppName("org.mozilla.firefox")).toBe("Firefox");
  });

  it("returns an unrecognised identifier unchanged", () => {
    expect(resolveSourceAppName("com.example.MysteryPlayer")).toBe("com.example.MysteryPlayer");
  });
});

import { describe, expect, it } from "vitest";
import { resolveStartHidden } from "../../../src/main/window/resolve-start-hidden.js";

describe("resolveStartHidden", () => {
  it("is true when startMinimized is on and this launch was actually triggered by the login item", () => {
    expect(resolveStartHidden(true, true)).toBe(true);
  });

  it("is false when startMinimized is on but this was a manual launch (double-click, not login)", () => {
    expect(resolveStartHidden(true, false)).toBe(false);
  });

  it("is false when startMinimized is off, regardless of how the app was launched", () => {
    expect(resolveStartHidden(false, true)).toBe(false);
    expect(resolveStartHidden(false, false)).toBe(false);
  });
});

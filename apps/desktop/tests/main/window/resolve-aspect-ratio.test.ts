import { describe, expect, it } from "vitest";
import { resolveAspectRatioValue } from "../../../src/main/window/resolve-aspect-ratio.js";

describe("resolveAspectRatioValue", () => {
  it("returns 0 (no lock) for 'free'", () => {
    expect(resolveAspectRatioValue("free")).toBe(0);
  });

  it("returns 16/9 for '16:9'", () => {
    expect(resolveAspectRatioValue("16:9")).toBeCloseTo(16 / 9, 10);
  });

  it("returns 4/3 for '4:3'", () => {
    expect(resolveAspectRatioValue("4:3")).toBeCloseTo(4 / 3, 10);
  });

  it("returns 1 (square) for '1:1'", () => {
    expect(resolveAspectRatioValue("1:1")).toBe(1);
  });

  it("returns 9/16 for '9:16'", () => {
    expect(resolveAspectRatioValue("9:16")).toBeCloseTo(9 / 16, 10);
  });
});

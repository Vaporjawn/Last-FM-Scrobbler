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

  it("returns 9/14 for '9:14'", () => {
    expect(resolveAspectRatioValue("9:14")).toBeCloseTo(9 / 14, 10);
  });

  it("falls back to 0 for a value that isn't a real AspectRatioOption", () => {
    // Regression test: this used to be a plain Record lookup with no fallback — an
    // invalid value (a stale/removed option from an older settings.json, or anything
    // that reached here without going through wire-settings.ts's own IPC-boundary
    // validation) returned `undefined` despite this function's declared `number`
    // return type, cascading into NaN throughout the window-geometry math downstream.
    // `as never` bypasses the compile-time type check to exercise the runtime guard.
    expect(resolveAspectRatioValue("21:9" as never)).toBe(0);
  });
});

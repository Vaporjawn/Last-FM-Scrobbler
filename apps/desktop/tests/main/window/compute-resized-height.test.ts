import { describe, expect, it } from "vitest";
import { computeResizedHeight } from "../../../src/main/window/compute-resized-height.js";

describe("computeResizedHeight", () => {
  it("returns the current height unchanged for 'free' (ratio 0)", () => {
    expect(computeResizedHeight(1100, 720, 0, 480)).toBe(720);
  });

  it("computes height from the current width for a locked ratio", () => {
    expect(computeResizedHeight(1200, 900, 16 / 9, 480)).toBe(675);
  });

  it("computes a square height equal to the current width", () => {
    expect(computeResizedHeight(800, 500, 1, 480)).toBe(800);
  });

  it("never resizes below minHeight", () => {
    // 400 / (16/9) ≈ 225, well under a 480 minimum.
    expect(computeResizedHeight(400, 900, 16 / 9, 480)).toBe(480);
  });
});

import { describe, expect, it } from "vitest";
import { computePortraitWindowSize } from "../../../src/main/window/compute-portrait-window-size.js";

describe("computePortraitWindowSize", () => {
  it("returns the current size unchanged for 'free' (ratio 0)", () => {
    expect(computePortraitWindowSize(1100, 720, 0, 680)).toEqual({ width: 1100, height: 720 });
  });

  it("anchors on minWidth, not the window's current (landscape) width", () => {
    // Anchoring on the current landscape width (1100) instead would derive a height
    // of 1100 / (9/16) ≈ 1956px — taller than almost any real screen. Anchoring on
    // minWidth (680) instead produces a window that's actually recognizable as
    // portrait: 680 / (9/16) = 1208.89, rounded to 1209.
    expect(computePortraitWindowSize(1100, 720, 9 / 16, 680)).toEqual({
      width: 680,
      height: 1209,
    });
  });

  it("ignores the window's current height too — always derives from minWidth", () => {
    expect(computePortraitWindowSize(680, 1209, 9 / 16, 680)).toEqual({
      width: 680,
      height: 1209,
    });
  });
});

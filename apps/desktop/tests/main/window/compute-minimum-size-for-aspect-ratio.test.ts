import { describe, expect, it } from "vitest";
import { computeMinimumSizeForAspectRatio } from "../../../src/main/window/compute-minimum-size-for-aspect-ratio.js";

describe("computeMinimumSizeForAspectRatio", () => {
  it("returns the two floors unchanged for 'free' (ratio 0) — no ratio to reconcile them against", () => {
    expect(computeMinimumSizeForAspectRatio(0, 680, 480, 1728, 1013)).toEqual({
      width: 680,
      height: 480,
    });
  });

  it("anchors on the width floor for a portrait ratio, when there's plenty of screen room", () => {
    // 680 / (9/14) = 1057.78, rounded to 1058 — comfortably taller than the 480
    // height floor, so the width floor is the binding constraint.
    expect(computeMinimumSizeForAspectRatio(9 / 14, 680, 480, 3000, 3000)).toEqual({
      width: 680,
      height: 1058,
    });
  });

  it("anchors on the height floor for a landscape ratio, when there's plenty of screen room", () => {
    // 480 * (16/9) = 853.33, rounded to 853 — comfortably wider than the 680 width
    // floor, so the height floor is the binding constraint here instead.
    expect(computeMinimumSizeForAspectRatio(16 / 9, 680, 480, 3000, 3000)).toEqual({
      width: 853,
      height: 480,
    });
  });

  it("produces an exactly square minimum for a 1:1 ratio", () => {
    expect(computeMinimumSizeForAspectRatio(1, 680, 480, 3000, 3000)).toEqual({
      width: 680,
      height: 680,
    });
  });

  it("scales both dimensions down together, preserving the exact ratio, when the ideal minimum would exceed the screen", () => {
    // Regression case: a 680-wide, 9:14-locked minimum needs ~1058px of height, which
    // exceeds this (real, reproduced) 1013px-tall screen's available work area —
    // verified live that enforcing that oversized minimum froze all future resizing
    // completely, not just resizing near the boundary. Scaling down keeps both floors
    // proportional (never independently clamped) and within a safety margin of what
    // the screen can actually provide.
    const result = computeMinimumSizeForAspectRatio(9 / 14, 680, 480, 1728, 1013);
    expect(result).toEqual({ width: 586, height: 911 });
    expect(result.width / result.height).toBeCloseTo(9 / 14, 2);
  });

  it("scales down the same way for a different portrait ratio on the same constrained screen", () => {
    const result = computeMinimumSizeForAspectRatio(9 / 16, 680, 480, 1728, 1013);
    expect(result).toEqual({ width: 512, height: 911 });
    expect(result.width / result.height).toBeCloseTo(9 / 16, 2);
  });

  it("doesn't scale a landscape ratio that already comfortably fits the same screen", () => {
    expect(computeMinimumSizeForAspectRatio(16 / 9, 680, 480, 1728, 1013)).toEqual({
      width: 853,
      height: 480,
    });
  });

  it("still produces a coherent, exactly-proportional minimum on a genuinely small screen", () => {
    const result = computeMinimumSizeForAspectRatio(9 / 14, 680, 480, 800, 600);
    expect(result).toEqual({ width: 347, height: 540 });
    expect(result.width / result.height).toBeCloseTo(9 / 14, 2);
  });
});

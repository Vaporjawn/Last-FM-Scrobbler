import { describe, expect, it } from "vitest";
import {
  applyAspectRatio,
  type AspectRatioTargetWindow,
} from "../../../src/main/window/apply-aspect-ratio.js";

const MIN_WIDTH = 680;
const MIN_HEIGHT = 480;
// Generous enough that computeMinimumSizeForAspectRatio's screen-safety scaling never
// kicks in for these tests — keeps the expected setSize values simple (anchored
// directly on MIN_WIDTH/MIN_HEIGHT). The screen-constrained scaling path itself is
// exercised separately below, with real, reproduced screen dimensions.
const PLENTY_OF_ROOM = { availableWidth: 3000, availableHeight: 3000 };

/** Records every `setAspectRatio`/`setMinimumSize`/`setSize` call, in order, against a
 * mutable bounds state — lets tests assert both the exact call *sequence* (the
 * load-bearing part of this fix — see `apply-aspect-ratio.ts`'s docstring for why) and
 * the resulting size. */
function fakeWindow(initialBounds: { width: number; height: number }): AspectRatioTargetWindow & {
  readonly calls: readonly string[];
} {
  let bounds = { x: 0, y: 0, ...initialBounds };
  const calls: string[] = [];
  return {
    get calls() {
      return calls;
    },
    setAspectRatio: (value) => {
      calls.push(`setAspectRatio(${value})`);
    },
    setMinimumSize: (width, height) => {
      calls.push(`setMinimumSize(${width}, ${height})`);
    },
    getBounds: () => bounds,
    setSize: (width, height) => {
      calls.push(`setSize(${width}, ${height})`);
      bounds = { ...bounds, width, height };
    },
  };
}

describe("applyAspectRatio", () => {
  it("clears the aspect ratio before resizing, and only reapplies the real one after — never resizes while a constraint is active", () => {
    // This exact order is the fix for a real, reproduced macOS bug: calling setSize()
    // while any aspect-ratio constraint is active (the target one, or one left over
    // from a previous call) corrupts the resulting size when the target needs
    // clamping against the screen — see this module's own docstring. A regression
    // back to "setAspectRatio(target) then setSize()" would reintroduce it silently,
    // since a mocked window can't reproduce the native corruption itself — this test
    // guards the ordering directly instead.
    const window = fakeWindow({ width: 1100, height: 720 });

    applyAspectRatio(window, "9:16", {
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      ...PLENTY_OF_ROOM,
    });

    expect(window.calls).toEqual([
      "setAspectRatio(0)",
      "setMinimumSize(680, 1209)",
      "setSize(680, 1209)",
      `setAspectRatio(${9 / 16})`,
    ]);
  });

  it("clears whatever ratio was previously active before resizing to a new portrait ratio", () => {
    // Simulates the exact sequence that reproduced the bug live: switching directly
    // from one portrait ratio to another, where the *first* call's reapplied ratio is
    // still active when the second call starts.
    const window = fakeWindow({ width: 680, height: 1010 });

    applyAspectRatio(window, "9:14", {
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      ...PLENTY_OF_ROOM,
    });

    // The very first call must clear the constraint, regardless of what was active
    // before — applyAspectRatio has no way to know the prior state, so it always clears.
    expect(window.calls[0]).toBe("setAspectRatio(0)");
    expect(window.calls.at(-1)).toBe(`setAspectRatio(${9 / 14})`);
  });

  it("derives a landscape/square size by keeping width fixed, and clears/reapplies around it the same way", () => {
    const window = fakeWindow({ width: 900, height: 1200 });

    applyAspectRatio(window, "16:9", {
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      ...PLENTY_OF_ROOM,
    });

    expect(window.calls).toEqual([
      "setAspectRatio(0)",
      "setMinimumSize(853, 480)",
      "setSize(900, 506)",
      `setAspectRatio(${16 / 9})`,
    ]);
  });

  it("skips the resize (but still clears/reapplies and updates the minimum size) when the current size already matches", () => {
    const window = fakeWindow({ width: 680, height: 1209 });

    applyAspectRatio(window, "9:16", {
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      ...PLENTY_OF_ROOM,
    });

    expect(window.calls).toEqual([
      "setAspectRatio(0)",
      "setMinimumSize(680, 1209)",
      `setAspectRatio(${9 / 16})`,
    ]);
  });

  it("picking 'free' clears the constraint, resets the minimum size to the flat floors, and leaves the current size untouched", () => {
    const window = fakeWindow({ width: 1100, height: 720 });

    applyAspectRatio(window, "free", {
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      ...PLENTY_OF_ROOM,
    });

    expect(window.calls).toEqual([
      "setAspectRatio(0)",
      "setMinimumSize(680, 480)",
      "setAspectRatio(0)",
    ]);
  });

  it("enforces a screen-safe, ratio-consistent minimum size — and resizes to that same size — on a real, reproduced constrained screen", () => {
    // Regression test for the second bug this function fixes: on this exact screen
    // (real numbers from a live reproduction), the flat 680×480 floors are
    // wildly inconsistent with a 9:14 lock (680 wide needs ~1058 tall — taller than
    // the screen itself), which is what let a live user drag trigger the native
    // corruption the instant it crossed the width floor. The enforced minimum here
    // must be both ratio-consistent AND within the screen's real capacity.
    const window = fakeWindow({ width: 1100, height: 720 });

    applyAspectRatio(window, "9:14", {
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      availableWidth: 1728,
      availableHeight: 1013,
    });

    expect(window.calls).toEqual([
      "setAspectRatio(0)",
      "setMinimumSize(586, 911)",
      "setSize(586, 911)",
      `setAspectRatio(${9 / 14})`,
    ]);
  });

  it("degrades to free (unconstrained) instead of cascading NaN for an invalid aspect ratio option", () => {
    // Regression test: wire-settings.ts now validates aspectRatio before this
    // function is ever reached via the live settings IPC path, but this asserts the
    // defense-in-depth fallback inside resolveAspectRatioValue actually holds for any
    // other caller — an invalid option used to produce `undefined`, then `NaN`
    // throughout every one of these calls (setMinimumSize(NaN, NaN),
    // setSize(NaN, NaN), setAspectRatio(NaN)).
    const window = fakeWindow({ width: 1100, height: 720 });

    applyAspectRatio(window, "21:9" as never, { minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT, ...PLENTY_OF_ROOM });

    for (const call of window.calls) {
      expect(call).not.toContain("NaN");
    }
    expect(window.calls).toContain("setAspectRatio(0)");
  });
});

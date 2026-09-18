import { describe, expect, it } from "vitest";
import { resolveErrorBoundaryColors } from "../../src/renderer/src/components/resolve-error-boundary-colors.js";

describe("resolveErrorBoundaryColors", () => {
  it("returns theme/index.ts's real dark background (not MUI's generic default) when isLight is false", () => {
    const colors = resolveErrorBoundaryColors(false);

    expect(colors.background).toBe("#0f0c0b");
    expect(colors.text).toBe("#fff");
  });

  it("returns theme/index.ts's real light background and contrastText when isLight is true", () => {
    const colors = resolveErrorBoundaryColors(true);

    expect(colors.background).toBe("#faf8f5");
    expect(colors.text).toBe("#1a120c");
  });

  it("returns readable (non-empty, distinct) subtle and panel colors for both modes", () => {
    const dark = resolveErrorBoundaryColors(false);
    const light = resolveErrorBoundaryColors(true);

    for (const colors of [dark, light]) {
      expect(colors.subtleText).not.toBe(colors.text);
      expect(colors.panelBackground).not.toBe(colors.background);
    }
    expect(dark.background).not.toBe(light.background);
  });
});

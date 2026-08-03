import { describe, expect, it } from "vitest";
import { combineFilters } from "../../src/filters/combine-filters.js";
import { compileFilter } from "../../src/filters/filter-expression.js";

const TRACK = {
  artist: "Everything Everything",
  title: "Weights",
  sourceApp: "com.google.Chrome",
  durationSec: 1200,
};

describe("combineFilters", () => {
  it("excludes a track matched by any one of the combined filters", () => {
    const neverMatches = compileFilter('sourceApp == "nothing"');
    const alwaysMatches = compileFilter('artist == "Everything Everything"');

    const combined = combineFilters([neverMatches, alwaysMatches]);

    expect(combined.test(TRACK)).toBe(true);
  });

  it("does not exclude a track matched by none of the combined filters", () => {
    const neverMatches1 = compileFilter('sourceApp == "nothing"');
    const neverMatches2 = compileFilter('artist == "nobody"');

    const combined = combineFilters([neverMatches1, neverMatches2]);

    expect(combined.test(TRACK)).toBe(false);
  });

  it("matches nothing when given no filters at all", () => {
    const combined = combineFilters([]);

    expect(combined.test(TRACK)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { evaluate } from "../../src/filters/evaluate.js";
import type { FilterableTrack } from "../../src/filters/filterable-track.js";
import type { ComparisonNode } from "../../src/filters/parser.js";

function track(overrides: Partial<FilterableTrack> = {}): FilterableTrack {
  return {
    artist: "Radiohead",
    title: "Idioteque",
    album: "Kid A",
    albumArtist: "Radiohead",
    durationSec: 300,
    sourceApp: "spotify",
    ...overrides,
  };
}

function comparison(overrides: Partial<ComparisonNode> = {}): ComparisonNode {
  return { type: "comparison", field: "durationSec", operator: "==", value: 300, ...overrides };
}

// These tests call `evaluate` directly with hand-built AST nodes rather than going
// through `compileFilter`/`parse`, specifically so every operator branch (including
// ones the real parser would never let through for a given field's type — e.g. a
// numeric field with an unrecognized operator) gets independently verified. `evaluate`
// is exported as its own public entry point, so its full behavior needs its own
// coverage regardless of what the parser happens to produce.
describe("evaluate", () => {
  describe("numeric comparisons", () => {
    it("evaluates ==", () => {
      const node = comparison({ operator: "==", value: 300 });
      expect(evaluate(node, track({ durationSec: 300 }))).toBe(true);
      expect(evaluate(node, track({ durationSec: 200 }))).toBe(false);
    });

    it("evaluates !=", () => {
      const node = comparison({ operator: "!=", value: 300 });
      expect(evaluate(node, track({ durationSec: 200 }))).toBe(true);
      expect(evaluate(node, track({ durationSec: 300 }))).toBe(false);
    });

    it("evaluates >", () => {
      const node = comparison({ operator: ">", value: 100 });
      expect(evaluate(node, track({ durationSec: 200 }))).toBe(true);
      expect(evaluate(node, track({ durationSec: 100 }))).toBe(false);
    });

    it("evaluates <=", () => {
      const node = comparison({ operator: "<=", value: 200 });
      expect(evaluate(node, track({ durationSec: 200 }))).toBe(true);
      expect(evaluate(node, track({ durationSec: 201 }))).toBe(false);
    });

    it("returns false for an operator the numeric branch doesn't recognize", () => {
      // Not reachable through the real parser (it validates operator/field-type
      // compatibility before building the AST) — this exercises evaluate's own
      // defensive fallback for a hand-built node with an operator numeric
      // comparisons don't support.
      const node = comparison({ operator: "contains", value: 300 });
      expect(evaluate(node, track({ durationSec: 300 }))).toBe(false);
    });

    it("returns false when the track has no value for the numeric field", () => {
      const node = comparison({ operator: "==", value: 300 });
      const trackWithoutDuration = track();
      delete (trackWithoutDuration as { durationSec?: number }).durationSec;
      expect(evaluate(node, trackWithoutDuration)).toBe(false);
    });

    it("returns false when the comparison value isn't a number", () => {
      const node = comparison({ operator: "==", value: "not-a-number" });
      expect(evaluate(node, track({ durationSec: 300 }))).toBe(false);
    });
  });

  describe("string comparisons", () => {
    it("returns false for an operator the string branch doesn't recognize", () => {
      // Same defensive-fallback rationale as the numeric case above: the real parser
      // never produces this shape, so it's exercised directly here.
      const node = comparison({ field: "artist", operator: "<", value: "Radiohead" });
      expect(evaluate(node, track({ artist: "Radiohead" }))).toBe(false);
    });

    it("falls back to an empty-string field value for an unknown field", () => {
      const node = comparison({ field: "notAKnownField", operator: "==", value: "" });
      expect(evaluate(node, track())).toBe(true);
    });
  });
});

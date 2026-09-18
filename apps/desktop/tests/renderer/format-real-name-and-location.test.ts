import { describe, expect, it } from "vitest";
import { formatRealNameAndLocation } from "../../src/renderer/src/utils/format-real-name-and-location.js";

describe("formatRealNameAndLocation", () => {
  it("combines both fields with a middle dot when both are present", () => {
    expect(formatRealNameAndLocation({ realName: "Nathan", location: "United Kingdom" })).toBe(
      "Nathan · United Kingdom",
    );
  });

  it("falls back to just realName when there's no location", () => {
    expect(formatRealNameAndLocation({ realName: "Nathan" })).toBe("Nathan");
  });

  it("falls back to just location when there's no realName", () => {
    expect(formatRealNameAndLocation({ location: "United Kingdom" })).toBe("United Kingdom");
  });

  it("returns undefined when neither field is present", () => {
    expect(formatRealNameAndLocation({})).toBeUndefined();
  });

  it("returns undefined when both fields are empty strings", () => {
    expect(formatRealNameAndLocation({ realName: "", location: "" })).toBeUndefined();
  });

  describe("the literal word 'None' (a real, confirmed Last.fm freeform-text quirk)", () => {
    // Regression coverage: Last.fm doesn't validate the location field, and some
    // real accounts have literally typed "None" into it rather than leaving it
    // unset — confirmed live, this rendered as a bare, seemingly system-generated
    // "None" in the friends list instead of being omitted like every other unset
    // field, reading as broken rather than as genuine content.

    it("treats a location of exactly 'None' the same as absent", () => {
      expect(formatRealNameAndLocation({ realName: "Nathan", location: "None" })).toBe("Nathan");
    });

    it("returns undefined when realName is absent and location is 'None'", () => {
      expect(formatRealNameAndLocation({ location: "None" })).toBeUndefined();
    });

    it("is case-insensitive ('none', 'NONE', 'NoNe')", () => {
      expect(formatRealNameAndLocation({ location: "none" })).toBeUndefined();
      expect(formatRealNameAndLocation({ location: "NONE" })).toBeUndefined();
      expect(formatRealNameAndLocation({ location: "NoNe" })).toBeUndefined();
    });

    it("ignores surrounding whitespace around 'None'", () => {
      expect(formatRealNameAndLocation({ location: "  None  " })).toBeUndefined();
    });

    it("also filters a realName of literally 'None', for the same reason", () => {
      expect(formatRealNameAndLocation({ realName: "None", location: "United Kingdom" })).toBe(
        "United Kingdom",
      );
    });

    it("doesn't filter a location that merely contains 'none' as part of a longer real word", () => {
      // "None" the whole field vs. a real place name/word that happens to contain
      // that substring — only an exact (trimmed, case-insensitive) match is treated
      // as the sentinel value; a substring match would incorrectly eat real content.
      expect(formatRealNameAndLocation({ location: "Nonesuch" })).toBe("Nonesuch");
    });
  });
});

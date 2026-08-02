import { describe, expect, it } from "vitest";
import { compileFilter } from "../../src/filters/filter-expression.js";
import type { FilterableTrack } from "../../src/filters/filter-expression.js";

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

/** A track with only the required fields — album/albumArtist/durationSec genuinely
 * absent, not present-with-value-undefined (exactOptionalPropertyTypes distinguishes
 * the two, and this is what "missing optional field" tests actually need). */
function minimalTrack(
  overrides: Partial<Pick<FilterableTrack, "artist" | "title" | "sourceApp">> = {},
): FilterableTrack {
  return {
    artist: "Radiohead",
    title: "Idioteque",
    sourceApp: "spotify",
    ...overrides,
  };
}

describe("compileFilter", () => {
  it("matches a simple string equality", () => {
    const filter = compileFilter('sourceApp == "firefox"');
    expect(filter.test(track({ sourceApp: "firefox" }))).toBe(true);
    expect(filter.test(track({ sourceApp: "spotify" }))).toBe(false);
  });

  it("matches string inequality", () => {
    const filter = compileFilter('sourceApp != "spotify"');
    expect(filter.test(track({ sourceApp: "vlc" }))).toBe(true);
    expect(filter.test(track({ sourceApp: "spotify" }))).toBe(false);
  });

  it("matches a regex against a field", () => {
    const filter = compileFilter("title matches /^Ad: /");
    expect(filter.test(track({ title: "Ad: Buy now" }))).toBe(true);
    expect(filter.test(track({ title: "Idioteque" }))).toBe(false);
  });

  it("supports regex flags", () => {
    const filter = compileFilter("title matches /advert/i");
    expect(filter.test(track({ title: "ADVERTISEMENT" }))).toBe(true);
  });

  it("matches a substring with contains", () => {
    const filter = compileFilter('album contains "Deluxe"');
    expect(filter.test(track({ album: "Kid A (Deluxe Edition)" }))).toBe(true);
    expect(filter.test(track({ album: "Kid A" }))).toBe(false);
  });

  it("treats a missing optional field as an empty string for string operators", () => {
    const filter = compileFilter('album contains "Deluxe"');
    expect(filter.test(minimalTrack())).toBe(false);
  });

  it("compares the numeric durationSec field", () => {
    expect(compileFilter("durationSec < 30").test(track({ durationSec: 15 }))).toBe(true);
    expect(compileFilter("durationSec < 30").test(track({ durationSec: 300 }))).toBe(false);
    expect(compileFilter("durationSec >= 300").test(track({ durationSec: 300 }))).toBe(true);
  });

  it("treats a missing durationSec as not matching any numeric comparison", () => {
    const filter = compileFilter("durationSec < 30");
    expect(filter.test(minimalTrack())).toBe(false);
  });

  it("combines conditions with and / or, with and binding tighter", () => {
    // sourceApp == "firefox" OR (title matches /ad/i AND durationSec < 30)
    const filter = compileFilter(
      'sourceApp == "firefox" or title matches /ad/i and durationSec < 30',
    );

    expect(filter.test(track({ sourceApp: "firefox", title: "Idioteque", durationSec: 300 }))).toBe(
      true,
    );
    expect(filter.test(track({ sourceApp: "spotify", title: "Advert", durationSec: 15 }))).toBe(
      true,
    );
    expect(filter.test(track({ sourceApp: "spotify", title: "Advert", durationSec: 300 }))).toBe(
      false,
    );
  });

  it("supports not and parentheses for grouping", () => {
    const filter = compileFilter('not (sourceApp == "firefox" or sourceApp == "chrome")');
    expect(filter.test(track({ sourceApp: "spotify" }))).toBe(true);
    expect(filter.test(track({ sourceApp: "firefox" }))).toBe(false);
  });

  it("throws a descriptive error for invalid syntax", () => {
    expect(() => compileFilter("sourceApp ==")).toThrow(/unexpected end of expression/i);
  });

  it("throws a descriptive error for an unknown field", () => {
    expect(() => compileFilter('notAField == "x"')).toThrow(/unknown field.*notAField/i);
  });

  it("throws a descriptive error for an unknown operator", () => {
    expect(() => compileFilter('sourceApp startsWith "a"')).toThrow(/unexpected token/i);
  });
});

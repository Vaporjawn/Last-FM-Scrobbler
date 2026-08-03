import { describe, expect, it } from "vitest";
import { FilterSyntaxError } from "../../src/filters/filter-syntax-error.js";
import { tokenize } from "../../src/filters/tokenizer.js";

describe("tokenize", () => {
  it("rejects a number literal with more than one decimal point", () => {
    // Regression test: this used to be accepted as a single "number" token whose
    // value (`Number("1.2.3")`) is `NaN` — silently matching or excluding every
    // track for any filter using it, instead of raising a syntax error.
    expect(() => tokenize("1.2.3")).toThrow(FilterSyntaxError);
    expect(() => tokenize("1.2.3")).toThrow(/invalid number literal "1\.2\.3"/);
  });

  it("still accepts a normal decimal number", () => {
    expect(tokenize("1.5")).toEqual([
      { type: "number", value: "1.5" },
      { type: "eof", value: "" },
    ]);
  });

  it("still accepts an integer", () => {
    expect(tokenize("300")).toEqual([
      { type: "number", value: "300" },
      { type: "eof", value: "" },
    ]);
  });

  it("supports an escaped delimiter inside a string literal", () => {
    expect(tokenize('"say \\"hi\\""')).toEqual([
      { type: "string", value: 'say "hi"' },
      { type: "eof", value: "" },
    ]);
  });

  it("supports an escaped delimiter inside a regex literal", () => {
    // Regression test: a regex matching a literal `/` (e.g. a URL) used to truncate
    // at the first raw `/`, leaving an invalid dangling `\` in the trailing text.
    const tokens = tokenize("/^https:\\/\\/foo/");
    expect(tokens[0]).toEqual({ type: "regex", value: "^https://foo", flags: "" });
  });

  it("supports an escaped backslash inside a string literal", () => {
    expect(tokenize('"a\\\\b"')).toEqual([
      { type: "string", value: "a\\b" },
      { type: "eof", value: "" },
    ]);
  });

  it("leaves non-delimiter backslash sequences in a regex body untouched", () => {
    // `\d` is regex syntax (a digit class), not a lexer escape — it must reach
    // `new RegExp(...)` in parser.ts exactly as written.
    const tokens = tokenize("/^\\d+$/");
    expect(tokens[0]).toEqual({ type: "regex", value: "^\\d+$", flags: "" });
  });

  it("throws on an unterminated string literal", () => {
    expect(() => tokenize('"unterminated')).toThrow(/unterminated string literal/i);
  });

  it("throws on an unterminated regex literal", () => {
    expect(() => tokenize("/unterminated")).toThrow(/unterminated regex literal/i);
  });
});

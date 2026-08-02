import { describe, expect, it } from "vitest";
import { parseStreamLine } from "../../src/smtc/parse-stream-line.js";

describe("parseStreamLine", () => {
  it("parses a well-formed payload line", () => {
    const line = JSON.stringify({
      title: "Song",
      artist: "Artist",
      sourceAppUserModelId: "App.exe",
    });

    expect(parseStreamLine(line)).toEqual({
      title: "Song",
      artist: "Artist",
      sourceAppUserModelId: "App.exe",
    });
  });

  it("returns null (not undefined) for a literal JSON null line — nothing is playing", () => {
    expect(parseStreamLine("null")).toBeNull();
  });

  it("returns undefined for a blank line (skip, don't change state)", () => {
    expect(parseStreamLine("")).toBeUndefined();
    expect(parseStreamLine("   ")).toBeUndefined();
  });

  it("returns undefined for malformed JSON rather than throwing", () => {
    expect(parseStreamLine("{not json")).toBeUndefined();
  });

  it("returns undefined for well-formed JSON that isn't an object or null", () => {
    expect(parseStreamLine("42")).toBeUndefined();
    expect(parseStreamLine('"a string"')).toBeUndefined();
    expect(parseStreamLine("[1,2,3]")).toBeUndefined();
  });

  it("tolerates and passes through stderr-style diagnostic prefixes by treating them as unparseable", () => {
    expect(parseStreamLine("SmtcHelper: System.Exception: something failed")).toBeUndefined();
  });
});

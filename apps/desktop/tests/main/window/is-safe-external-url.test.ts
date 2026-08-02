import { describe, expect, it } from "vitest";
import { isSafeExternalUrl } from "../../../src/main/window/is-safe-external-url.js";

describe("isSafeExternalUrl", () => {
  it("returns true for a normal https:// URL", () => {
    expect(isSafeExternalUrl("https://www.last.fm/music/Radiohead")).toBe(true);
  });

  it("returns true for a normal http:// URL", () => {
    expect(isSafeExternalUrl("http://example.com")).toBe(true);
  });

  it("returns false for a file:// URL", () => {
    expect(isSafeExternalUrl("file:///etc/passwd")).toBe(false);
  });

  it("returns false for a javascript: URL", () => {
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
  });

  it("returns false for a custom-scheme URL", () => {
    expect(isSafeExternalUrl("myapp://x")).toBe(false);
  });

  it("returns false for a malformed string that isn't a URL at all", () => {
    expect(isSafeExternalUrl("not a url")).toBe(false);
  });
});

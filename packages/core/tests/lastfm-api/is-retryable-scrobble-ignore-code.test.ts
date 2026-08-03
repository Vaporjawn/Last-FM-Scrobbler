import { describe, expect, it } from "vitest";
import { isRetryableScrobbleIgnoreCode } from "../../src/lastfm-api/is-retryable-scrobble-ignore-code.js";

describe("isRetryableScrobbleIgnoreCode", () => {
  it("treats a bad timestamp (too old or too new) as non-retryable", () => {
    expect(isRetryableScrobbleIgnoreCode(3)).toBe(false);
    expect(isRetryableScrobbleIgnoreCode(4)).toBe(false);
  });

  it("treats content-based ignores (artist/track ignored) as non-retryable", () => {
    expect(isRetryableScrobbleIgnoreCode(1)).toBe(false);
    expect(isRetryableScrobbleIgnoreCode(2)).toBe(false);
  });

  it("treats the daily limit exceeded ignore as retryable later", () => {
    expect(isRetryableScrobbleIgnoreCode(5)).toBe(true);
  });
});

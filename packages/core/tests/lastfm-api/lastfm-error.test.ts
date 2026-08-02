import { describe, expect, it } from "vitest";
import {
  LastfmApiError,
  isRetryableApiErrorCode,
  isRetryableScrobbleIgnoreCode,
} from "../../src/lastfm-api/lastfm-error.js";

describe("LastfmApiError", () => {
  it("carries the numeric error code and message", () => {
    const error = new LastfmApiError(9, "Invalid session key - Please re-authenticate");
    expect(error.code).toBe(9);
    expect(error.message).toBe("Invalid session key - Please re-authenticate");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("isRetryableApiErrorCode", () => {
  it.each([8, 11, 16, 29])("treats code %i as retryable (transient/rate-limit)", (code) => {
    expect(isRetryableApiErrorCode(code)).toBe(true);
  });

  it.each([2, 3, 4, 5, 6, 7, 9, 10, 13, 14, 26, 27])(
    "treats code %i as non-retryable (permanent, needs a code/config/auth fix)",
    (code) => {
      expect(isRetryableApiErrorCode(code)).toBe(false);
    },
  );
});

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

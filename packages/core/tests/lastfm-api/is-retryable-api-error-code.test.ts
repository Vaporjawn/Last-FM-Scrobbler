import { describe, expect, it } from "vitest";
import { isRetryableApiErrorCode } from "../../src/lastfm-api/is-retryable-api-error-code.js";

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

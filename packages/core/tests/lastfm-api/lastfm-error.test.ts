import { describe, expect, it } from "vitest";
import { LastfmApiError } from "../../src/lastfm-api/lastfm-error.js";

describe("LastfmApiError", () => {
  it("carries the numeric error code and message", () => {
    const error = new LastfmApiError(9, "Invalid session key - Please re-authenticate");
    expect(error.code).toBe(9);
    expect(error.message).toBe("Invalid session key - Please re-authenticate");
    expect(error).toBeInstanceOf(Error);
  });
});

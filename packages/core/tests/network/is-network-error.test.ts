import { describe, expect, it } from "vitest";
import { isNetworkError } from "../../src/network/is-network-error.js";

class FakeApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "FakeApiError";
  }
}

function errorWithCode(code: string): Error {
  const error = new Error(`Request failed`);
  (error as unknown as { code: string }).code = code;
  return error;
}

function fetchFailedError(cause?: Error): TypeError {
  const error = new TypeError("fetch failed");
  if (cause) {
    (error as unknown as { cause: Error }).cause = cause;
  }
  return error;
}

describe("isNetworkError", () => {
  it.each([
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ETIMEDOUT",
    "ECONNRESET",
    "ENETUNREACH",
    "EHOSTUNREACH",
  ])("treats a direct %s error code as a network error", (code) => {
    expect(isNetworkError(errorWithCode(code))).toBe(true);
  });

  it("treats a bare 'fetch failed' TypeError with no further detail as a network error", () => {
    expect(isNetworkError(fetchFailedError())).toBe(true);
  });

  it("treats a 'fetch failed' TypeError whose .cause carries a network error code as a network error", () => {
    expect(isNetworkError(fetchFailedError(errorWithCode("ECONNREFUSED")))).toBe(true);
  });

  it("treats an application-level API error (has a numeric .code, not a network error code) as non-network", () => {
    expect(isNetworkError(new FakeApiError(6, "The artist you supplied could not be found"))).toBe(
      false,
    );
  });

  it("treats a plain Error with an unrelated message as non-network", () => {
    expect(isNetworkError(new Error("something else went wrong"))).toBe(false);
  });

  it("treats a non-Error thrown value as non-network", () => {
    expect(isNetworkError("a string, not an Error")).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError({ code: "ECONNREFUSED" })).toBe(false);
  });
});

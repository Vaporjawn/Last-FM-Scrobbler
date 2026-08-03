import { describe, expect, it } from "vitest";
import { parseBugReportRequest } from "../src/parse-bug-report-request.js";

describe("parseBugReportRequest", () => {
  it("accepts a well-formed report", () => {
    const result = parseBugReportRequest({
      title: "  Crash on launch  ",
      body: "  App crashes on launch on Linux.  ",
    });

    expect(result).toEqual({
      title: "Crash on launch",
      body: "App crashes on launch on Linux.",
      diagnostics: undefined,
    });
  });

  it("accepts optional string diagnostics", () => {
    const result = parseBugReportRequest({
      title: "Crash",
      body: "Details",
      diagnostics: { os: "linux", appVersion: "0.0.0" },
    });

    expect(result.diagnostics).toEqual({ os: "linux", appVersion: "0.0.0" });
  });

  it("rejects a non-object payload", () => {
    expect(() => parseBugReportRequest("not an object")).toThrow(
      "Request body must be a JSON object",
    );
  });

  it("rejects a missing or empty title", () => {
    expect(() => parseBugReportRequest({ title: "", body: "x" })).toThrow(
      "`title` is required and must be a non-empty string",
    );
  });

  it("rejects a missing or empty body", () => {
    expect(() => parseBugReportRequest({ title: "x", body: "   " })).toThrow(
      "`body` is required and must be a non-empty string",
    );
  });

  it("rejects non-string diagnostics values", () => {
    expect(() =>
      parseBugReportRequest({ title: "x", body: "y", diagnostics: { count: 5 } }),
    ).toThrow("`diagnostics` values must all be strings");
  });

  it("rejects diagnostics supplied as an array", () => {
    // Regression test: `typeof [] === "object"` is `true` in JS, so an array payload
    // used to pass the object check as-is and be silently reinterpreted by
    // Object.entries as `{"0":"a","1":"b"}` — diverging from the declared
    // `Record<string, string>` type without ever being rejected.
    expect(() =>
      parseBugReportRequest({ title: "x", body: "y", diagnostics: ["a", "b"] }),
    ).toThrow("`diagnostics` must be an object of string values when present");
  });

  describe("length limits", () => {
    it("accepts a title at exactly the limit", () => {
      const title = "x".repeat(256);

      expect(parseBugReportRequest({ title, body: "y" }).title).toBe(title);
    });

    it("rejects a title over the limit", () => {
      const title = "x".repeat(257);

      expect(() => parseBugReportRequest({ title, body: "y" })).toThrow(
        "`title` must be 256 characters or fewer",
      );
    });

    it("accepts a body at exactly the limit", () => {
      const body = "x".repeat(60_000);

      expect(parseBugReportRequest({ title: "x", body }).body).toBe(body);
    });

    it("rejects a body over the limit", () => {
      const body = "x".repeat(60_001);

      expect(() => parseBugReportRequest({ title: "x", body })).toThrow(
        "`body` must be 60000 characters or fewer",
      );
    });

    it("rejects an oversized diagnostics value, naming which key", () => {
      expect(() =>
        parseBugReportRequest({
          title: "x",
          body: "y",
          diagnostics: { recentLogs: "x".repeat(10_001) },
        }),
      ).toThrow("`diagnostics.recentLogs` must be 10000 characters or fewer");
    });

    it("rejects too many diagnostics keys", () => {
      const diagnostics = Object.fromEntries(
        Array.from({ length: 21 }, (_, index) => [`key${index}`, "value"]),
      );

      expect(() => parseBugReportRequest({ title: "x", body: "y", diagnostics })).toThrow(
        "`diagnostics` must have 20 keys or fewer",
      );
    });
  });
});

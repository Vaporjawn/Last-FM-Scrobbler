import { describe, expect, it } from "vitest";
import { parseBugReportRequest } from "../src/index.js";

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
});

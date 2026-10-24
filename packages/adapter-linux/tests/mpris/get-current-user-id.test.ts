import { describe, expect, it } from "vitest";
import { getCurrentUserId } from "../../src/mpris/get-current-user-id.js";

describe("getCurrentUserId", () => {
  it("returns the id from getuid when the platform has one", () => {
    expect(getCurrentUserId({ getuid: () => 1000 })).toBe(1000);
  });

  it("returns undefined when the platform has no getuid (Windows)", () => {
    expect(getCurrentUserId({})).toBeUndefined();
  });

  it("defaults to the real process", () => {
    const id = getCurrentUserId();
    expect(id === undefined || Number.isInteger(id)).toBe(true);
  });
});

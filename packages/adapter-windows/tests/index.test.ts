import { describe, expect, it } from "vitest";
import { createWindowsPlaybackSource } from "../src/index.js";

describe("createWindowsPlaybackSource", () => {
  it("throws until the real SMTC implementation lands", () => {
    expect(() => createWindowsPlaybackSource()).toThrow(
      "createWindowsPlaybackSource is not implemented yet — see docs/modules/adapter-windows.md",
    );
  });
});

import { describe, expect, it } from "vitest";
import { createLinuxPlaybackSource } from "../src/index.js";

describe("createLinuxPlaybackSource", () => {
  it("throws until the real MPRIS implementation lands", () => {
    expect(() => createLinuxPlaybackSource()).toThrow(
      "createLinuxPlaybackSource is not implemented yet — see docs/modules/adapter-linux.md",
    );
  });
});

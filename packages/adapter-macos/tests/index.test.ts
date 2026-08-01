import { describe, expect, it } from "vitest";
import { createMacosPlaybackSource } from "../src/index.js";

describe("createMacosPlaybackSource", () => {
  it("throws until the real MediaRemote implementation lands", () => {
    expect(() => createMacosPlaybackSource()).toThrow(
      "createMacosPlaybackSource is not implemented yet — see docs/modules/adapter-macos.md",
    );
  });
});

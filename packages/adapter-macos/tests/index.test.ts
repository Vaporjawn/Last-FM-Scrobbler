import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
}));

describe("createMacosPlaybackSource", () => {
  it("throws a clear, actionable error when MediaRemoteAdapter.framework hasn't been built", async () => {
    const { createMacosPlaybackSource } = await import("../src/index.js");

    expect(() => createMacosPlaybackSource()).toThrow(
      /MediaRemoteAdapter\.framework not found.*build-native\.mjs/s,
    );
  });
});

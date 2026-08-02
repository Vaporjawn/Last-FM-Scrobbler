import { describe, expect, it, vi } from "vitest";

// package.json exists (so the package root resolves normally), but SmtcHelper.exe
// itself doesn't — the actual "hasn't been built yet" condition this error reports.
vi.mock("node:fs", () => ({
  existsSync: vi.fn((path: string) => !path.endsWith("SmtcHelper.exe")),
}));

describe("createWindowsPlaybackSource", () => {
  it("throws a clear, actionable error when SmtcHelper.exe hasn't been built", async () => {
    const { createWindowsPlaybackSource } = await import("../src/index.js");

    // The helper process is spawned lazily on first subscription (not eagerly in the
    // factory call itself) — see create-windows-playback-source.ts — so the error only
    // surfaces once something actually tries to use the source.
    const source = createWindowsPlaybackSource();
    expect(() => source.onTrackChanged(() => undefined)).toThrow(
      /SmtcHelper\.exe has not been built yet.*build:native/s,
    );
  });
});

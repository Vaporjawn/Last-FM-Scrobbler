import { describe, expect, it, vi } from "vitest";
import type { PathLike } from "node:fs";
import type * as NodeFs from "node:fs";

/** Delegates every real filesystem check through to the actual `node:fs` — including
 * `findPackageRoot`'s `package.json` walk, which this genuinely exercises against the
 * real, on-disk package root rather than a stub — except `MediaRemoteAdapter.framework`
 * itself, which always reports as missing regardless of whether it's actually been
 * built on this machine, so these tests are deterministic either way. */
function mockFrameworkNotBuilt(): void {
  vi.resetModules();
  vi.doMock("node:fs", async () => {
    const actual = await vi.importActual<typeof NodeFs>("node:fs");
    return {
      ...actual,
      existsSync: vi.fn((path: PathLike) =>
        String(path).includes("MediaRemoteAdapter.framework") ? false : actual.existsSync(path),
      ),
    };
  });
}

describe("createMacosPlaybackSource", () => {
  it("throws a clear, actionable error when MediaRemoteAdapter.framework hasn't been built", async () => {
    mockFrameworkNotBuilt();
    const { createMacosPlaybackSource } = await import("../src/index.js");

    expect(() => createMacosPlaybackSource()).toThrow(
      /MediaRemoteAdapter\.framework not found.*build-native\.mjs/s,
    );
  });

  it("reports the framework path inside this package's own native-build/, not some other directory", async () => {
    // Regression test: a prior refactor's path-resolution bug reported
    // "<repo>/packages/native-build/..." (missing the adapter-macos segment) instead
    // of "<repo>/packages/adapter-macos/native-build/..." — see
    // find-package-root.ts's docstring for the full story. Asserting the exact
    // package segment appears (immediately followed by native-build/) is what would
    // have caught that regression; the previous version of this test only checked
    // that *an* error was thrown, which passes regardless of which (wrong) path it
    // names.
    mockFrameworkNotBuilt();
    const { createMacosPlaybackSource } = await import("../src/index.js");

    expect(() => createMacosPlaybackSource()).toThrow(
      /[/\\]adapter-macos[/\\]native-build[/\\]MediaRemoteAdapter\.framework/,
    );
  });

  it("throws AdapterMacosPackageRootNotFoundError if no package.json can be found at all", async () => {
    vi.resetModules();
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => false),
    }));
    const { createMacosPlaybackSource, AdapterMacosPackageRootNotFoundError } =
      await import("../src/index.js");

    expect(() => createMacosPlaybackSource()).toThrow(AdapterMacosPackageRootNotFoundError);
  });
});

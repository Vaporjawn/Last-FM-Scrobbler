import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findPackageRoot } from "../src/media-remote/find-package-root.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("findPackageRoot", () => {
  it("finds the package root when starting exactly there", () => {
    expect(findPackageRoot(packageRoot)).toBe(packageRoot);
  });

  it("walks up from a nested starting directory to find the package root", () => {
    // Mirrors where the real caller (create-macos-playback-source.ts) actually starts
    // from — src/media-remote/ — as well as the flattened bundled dist/index.js's own
    // location, both of which must resolve to the same package root.
    const nestedSourceDir = join(packageRoot, "src", "media-remote");
    expect(findPackageRoot(nestedSourceDir)).toBe(packageRoot);

    const bundledDistDir = join(packageRoot, "dist");
    expect(findPackageRoot(bundledDistDir)).toBe(packageRoot);
  });

  it("returns null when no package.json can be found walking all the way to the filesystem root", () => {
    expect(findPackageRoot("/")).toBeNull();
  });
});

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveResourcePath } from "../../src/main/resolve-resource-path.js";

// Expected values are built with the same `join()` the implementation itself uses,
// not hardcoded POSIX-style literals: `join()` normalizes to backslashes on Windows
// (its own correct, real behavior — Windows genuinely wants backslash paths), so a
// literal forward-slash string only ever matched on POSIX and failed every Windows CI
// run with a spurious separator mismatch. Comparing against `join()`'s own output
// verifies the actual thing this function promises (appPath/resourcesPath selection,
// segment order) without asserting a separator character that was never this
// function's job to control.
describe("resolveResourcePath", () => {
  it("resolves against appPath when not packaged (dev mode)", () => {
    expect(
      resolveResourcePath(
        { appPath: "/repo/apps/desktop", resourcesPath: "/should/not/be/used", isPackaged: false },
        "app-icon.png",
      ),
    ).toBe(join("/repo/apps/desktop", "resources", "app-icon.png"));
  });

  it("resolves against resourcesPath when packaged — not appPath, which would point inside app.asar", () => {
    expect(
      resolveResourcePath(
        {
          appPath: "/Applications/Last.fm Scrobbler.app/Contents/Resources/app.asar",
          resourcesPath: "/Applications/Last.fm Scrobbler.app/Contents/Resources",
          isPackaged: true,
        },
        "app-icon.png",
      ),
    ).toBe(join("/Applications/Last.fm Scrobbler.app/Contents/Resources", "resources", "app-icon.png"));
  });

  it("joins multiple path segments", () => {
    expect(
      resolveResourcePath(
        { appPath: "/repo/apps/desktop", resourcesPath: "/unused", isPackaged: false },
        "a",
        "b.png",
      ),
    ).toBe(join("/repo/apps/desktop", "resources", "a", "b.png"));
  });
});

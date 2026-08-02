import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAppIconPath } from "../../src/main/resolve-app-icon-path.js";

// See resolve-resource-path.test.ts's top comment for why expected values are built
// with `join()` rather than hardcoded POSIX-style literals.
describe("resolveAppIconPath", () => {
  it("resolves to resources/app-icon.png under appPath when not packaged", () => {
    expect(
      resolveAppIconPath({ appPath: "/repo/apps/desktop", resourcesPath: "/unused", isPackaged: false }),
    ).toBe(join("/repo/apps/desktop", "resources", "app-icon.png"));
  });

  it("resolves under resourcesPath when packaged", () => {
    expect(
      resolveAppIconPath({
        appPath: "/App.app/Contents/Resources/app.asar",
        resourcesPath: "/App.app/Contents/Resources",
        isPackaged: true,
      }),
    ).toBe(join("/App.app/Contents/Resources", "resources", "app-icon.png"));
  });
});

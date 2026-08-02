import { describe, expect, it } from "vitest";
import { resolveAppIconPath } from "../../src/main/resolve-app-icon-path.js";

describe("resolveAppIconPath", () => {
  it("resolves to resources/app-icon.png under appPath when not packaged", () => {
    expect(
      resolveAppIconPath({ appPath: "/repo/apps/desktop", resourcesPath: "/unused", isPackaged: false }),
    ).toBe("/repo/apps/desktop/resources/app-icon.png");
  });

  it("resolves under resourcesPath when packaged", () => {
    expect(
      resolveAppIconPath({
        appPath: "/App.app/Contents/Resources/app.asar",
        resourcesPath: "/App.app/Contents/Resources",
        isPackaged: true,
      }),
    ).toBe("/App.app/Contents/Resources/resources/app-icon.png");
  });
});

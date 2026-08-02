import { describe, expect, it } from "vitest";
import { resolveTrayIconPath } from "../../../src/main/tray/resolve-tray-icon-path.js";

const DEV_OPTIONS = { appPath: "/app", resourcesPath: "/unused", isPackaged: false };

describe("resolveTrayIconPath", () => {
  it("resolves to the template icon on macOS", () => {
    expect(resolveTrayIconPath(DEV_OPTIONS, "darwin")).toBe("/app/resources/tray-iconTemplate.png");
  });

  it("resolves to the colored icon on Windows", () => {
    expect(resolveTrayIconPath(DEV_OPTIONS, "win32")).toBe("/app/resources/tray-icon.png");
  });

  it("resolves to the colored icon on Linux", () => {
    expect(resolveTrayIconPath(DEV_OPTIONS, "linux")).toBe("/app/resources/tray-icon.png");
  });

  it("resolves against resourcesPath instead of appPath when packaged", () => {
    expect(
      resolveTrayIconPath(
        {
          appPath: "/App.app/Contents/Resources/app.asar",
          resourcesPath: "/App.app/Contents/Resources",
          isPackaged: true,
        },
        "darwin",
      ),
    ).toBe("/App.app/Contents/Resources/resources/tray-iconTemplate.png");
  });
});

import { describe, expect, it } from "vitest";
import { resolveResourcePath } from "../../src/main/resolve-resource-path.js";

describe("resolveResourcePath", () => {
  it("resolves against appPath when not packaged (dev mode)", () => {
    expect(
      resolveResourcePath(
        { appPath: "/repo/apps/desktop", resourcesPath: "/should/not/be/used", isPackaged: false },
        "app-icon.png",
      ),
    ).toBe("/repo/apps/desktop/resources/app-icon.png");
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
    ).toBe("/Applications/Last.fm Scrobbler.app/Contents/Resources/resources/app-icon.png");
  });

  it("joins multiple path segments", () => {
    expect(
      resolveResourcePath(
        { appPath: "/repo/apps/desktop", resourcesPath: "/unused", isPackaged: false },
        "a",
        "b.png",
      ),
    ).toBe("/repo/apps/desktop/resources/a/b.png");
  });
});

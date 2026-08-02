import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveExpectedRendererOrigin } from "../../src/main/resolve-expected-renderer-origin.js";

describe("resolveExpectedRendererOrigin", () => {
  it("returns the dev server's real origin when ELECTRON_RENDERER_URL is set", () => {
    expect(resolveExpectedRendererOrigin("/irrelevant", "http://localhost:5173")).toBe(
      "http://localhost:5173",
    );
  });

  it("strips any path/query the dev server URL happens to include, keeping just the origin", () => {
    expect(resolveExpectedRendererOrigin("/irrelevant", "http://localhost:5173/some/path?x=1")).toBe(
      "http://localhost:5173",
    );
  });

  it("returns a real file: URL (not the string \"null\") pointing at renderer/index.html when packaged", () => {
    const result = resolveExpectedRendererOrigin(`${sep}app${sep}out${sep}main`, undefined);

    expect(result.startsWith("file://")).toBe(true);
    expect(result.endsWith("/out/renderer/index.html")).toBe(true);
    // The one thing this function exists to get right: it must NOT be the degenerate
    // RFC-6454 origin every file: URL shares — see validate-ipc-sender.ts's docstring.
    expect(result).not.toBe("null");
  });

  it("resolves the packaged path relative to rendererDirname, one level up into renderer/", () => {
    // `resolve(sep, ...)` rather than a bare `${sep}some${sep}nested${sep}main`
    // literal: on Windows, a driveless root-relative path like `\some\nested\main`
    // isn't what a real `rendererDirname` (from `app.getAppPath()`) would ever
    // actually look like — it always has a drive letter. `pathToFileURL` resolves a
    // driveless path against `process.cwd()`'s drive internally, which silently
    // prepended the CI runner's actual drive (e.g. `D:`) and broke an exact-match
    // assertion against a hardcoded driveless expected string. `resolve()` performs
    // that same drive-aware resolution up front, for both the input and the expected
    // value below, so the two agree regardless of platform or CI runner drive letter.
    const mainDir = resolve(sep, "some", "nested", "main");

    const result = resolveExpectedRendererOrigin(mainDir, undefined);

    expect(result).toBe(pathToFileURL(resolve(mainDir, "../renderer/index.html")).href);
  });
});

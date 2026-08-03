import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { AdapterWindowsPackageRootNotFoundError } from "../../src/smtc/adapter-windows-package-root-not-found-error.js";
import { resolveHelperPath } from "../../src/smtc/resolve-helper-path.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("resolveHelperPath", () => {
  it("computes the expected native-build/SmtcHelper.exe path from the package root", () => {
    const result = resolveHelperPath(packageRoot);

    expect(result.helperPath).toBe(join(packageRoot, "native-build", "SmtcHelper.exe"));
  });

  it("walks up from a nested starting directory to find the package root", () => {
    const nested = join(packageRoot, "src", "smtc");

    const result = resolveHelperPath(nested);

    expect(result.helperPath).toBe(join(packageRoot, "native-build", "SmtcHelper.exe"));
  });

  it("reports whether the helper has actually been built", () => {
    const result = resolveHelperPath(packageRoot);

    expect(typeof result.helperBuilt).toBe("boolean");
  });

  it("throws AdapterWindowsPackageRootNotFoundError when no package root can be found", () => {
    expect(() => resolveHelperPath("/")).toThrow(AdapterWindowsPackageRootNotFoundError);
  });
});

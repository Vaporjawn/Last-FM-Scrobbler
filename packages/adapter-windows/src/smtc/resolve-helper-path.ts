import { existsSync } from "node:fs";
import { join } from "node:path";
import { AdapterWindowsPackageRootNotFoundError } from "./adapter-windows-package-root-not-found-error.js";
import { findPackageRoot } from "./find-package-root.js";

export interface ResolvedHelperPath {
  /** Absolute path to the (possibly not-yet-built) SmtcHelper.exe. */
  readonly helperPath: string;
  /** Whether `helperPath` currently exists on disk. */
  readonly helperBuilt: boolean;
}
/**
 * Resolves the path to the compiled `SmtcHelper.exe` (built from
 * `native/SmtcHelper/` via `scripts/build-native.mjs`, a Windows-only step — see
 * docs/modules/adapter-windows.md), relative to the `@lastfm-scrobbler/adapter-windows`
 * package root. Works whether called from `src/smtc/` (tests) or the bundled
 * `dist/index.js` by walking upward to find the nearest `package.json`.
 */
export function resolveHelperPath(startDir: string): ResolvedHelperPath {
  const packageRoot = findPackageRoot(startDir);
  if (packageRoot === null) {
    throw new AdapterWindowsPackageRootNotFoundError(startDir);
  }

  const helperPath = join(packageRoot, "native-build", "SmtcHelper.exe");
  return { helperPath, helperBuilt: existsSync(helperPath) };
}

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Walks upward from `startDir` until a directory containing a `package.json` is found.
 *
 * Deliberately makes no assumption about how many directory levels separate the
 * running code from the package root — a fixed-count `".."` traversal from
 * `import.meta.url` looks correct when verified against this file's own location in
 * the source tree, but silently breaks once tsup bundles every source file into a
 * single flat `dist/index.js` (always exactly one level deep from the package root,
 * regardless of how deeply the original source was nested — confirmed this is exactly
 * what happened here: a prior refactor moved this package-root-resolving code one
 * level deeper into `src/media-remote/` and adjusted the traversal count to match,
 * which was correct for the *source* file but wrong for the *bundled* one, silently
 * pointing every consumer at the wrong `native-build/` directory). Walking upward for
 * the nearest `package.json` instead works identically whether the caller is a raw
 * source file (tests) or the bundled `dist/index.js` — same pattern already used by
 * `packages/adapter-windows/src/smtc/resolve-helper-path.ts` for the identical
 * problem.
 */
export function findPackageRoot(startDir: string): string | null {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

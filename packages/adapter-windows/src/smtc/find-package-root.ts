import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** Walks upward from `startDir` until a directory containing a package.json is found. */
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

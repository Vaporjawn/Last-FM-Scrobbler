import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { rootDir } from "./root-dir.mjs";

/**
 * Expands the root package.json `workspaces` globs (only the `dir/*` and literal-directory
 * forms this repo uses) into absolute directories that contain a package.json.
 *
 * @param {string[]} globs The `workspaces` entries from the root package.json.
 * @returns {string[]} Absolute paths of the workspace package directories.
 */
export function expandWorkspaceGlobs(globs) {
  const dirs = [];
  for (const glob of globs) {
    if (glob.endsWith("/*")) {
      const parent = join(rootDir, glob.slice(0, -2));
      if (!existsSync(parent)) continue;
      for (const entry of readdirSync(parent)) {
        const full = join(parent, entry);
        if (statSync(full).isDirectory() && existsSync(join(full, "package.json"))) {
          dirs.push(full);
        }
      }
    } else {
      const full = join(rootDir, glob);
      if (existsSync(join(full, "package.json"))) {
        dirs.push(full);
      }
    }
  }
  return dirs;
}

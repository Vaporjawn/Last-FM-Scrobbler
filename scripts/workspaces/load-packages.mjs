import { join } from "node:path";
import { expandWorkspaceGlobs } from "./expand-workspace-globs.mjs";
import { readJson } from "./read-json.mjs";
import { rootDir } from "./root-dir.mjs";

/**
 * Loads every workspace package declared in the root package.json.
 *
 * @returns {{ dir: string, name: string, pkg: any }[]} Each package's directory, name and
 *   parsed package.json, in declared order.
 */
export function loadPackages() {
  const rootPkg = readJson(join(rootDir, "package.json"));
  const globs = rootPkg.workspaces ?? [];
  const dirs = expandWorkspaceGlobs(globs);
  return dirs.map((dir) => {
    const pkg = readJson(join(dir, "package.json"));
    return { dir, name: pkg.name, pkg };
  });
}

#!/usr/bin/env node
// Runs a package.json script across every workspace package, regardless of which
// package manager (npm, pnpm, or bun) is driving it. This exists because none of the
// three understand a single shared script string for "run this in every workspace,
// skipping packages that don't define it": pnpm's syntax is `-r --if-present`, npm's is
// `--workspaces --if-present`, and bun's is `--filter`. Rather than pick one and force
// the others to shell out to a specific manager, this script detects which manager
// actually invoked it and dispatches to that same manager per package.
//
// Usage:
//   node scripts/run-workspaces.mjs <script> [--package <name>]
//
// Skips (does not error on) any workspace package whose package.json doesn't define
// <script> — matching "--if-present" semantics. Stops at the first failing package.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function detectPackageManager() {
  const userAgent = process.env.npm_config_user_agent;
  if (userAgent) {
    const name = userAgent.split("/")[0];
    if (name === "npm" || name === "pnpm" || name === "bun" || name === "yarn") {
      return name;
    }
  }
  // Not invoked through a package manager's `run` wrapper (e.g. called directly via
  // `node scripts/run-workspaces.mjs`) — default to npm, since it ships with Node.
  return "npm";
}

function expandWorkspaceGlobs(globs) {
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

function loadPackages() {
  const rootPkg = readJson(join(rootDir, "package.json"));
  const globs = rootPkg.workspaces ?? [];
  const dirs = expandWorkspaceGlobs(globs);
  return dirs.map((dir) => {
    const pkg = readJson(join(dir, "package.json"));
    return { dir, name: pkg.name, pkg };
  });
}

// Topologically sorts packages so that any workspace package a given package depends
// on (via a "@lastfm-scrobbler/*" dependency) runs before it. Falls back to declared
// order for packages with no inter-workspace dependencies.
function topoSort(packages) {
  const byName = new Map(packages.map((p) => [p.name, p]));
  const visited = new Set();
  const sorted = [];

  function visit(pkg) {
    if (visited.has(pkg.name)) return;
    visited.add(pkg.name);
    const deps = { ...pkg.pkg.dependencies, ...pkg.pkg.devDependencies };
    for (const depName of Object.keys(deps)) {
      const depPkg = byName.get(depName);
      if (depPkg) visit(depPkg);
    }
    sorted.push(pkg);
  }

  for (const pkg of packages) visit(pkg);
  return sorted;
}

function main() {
  const args = process.argv.slice(2);
  const scriptName = args[0];
  if (!scriptName) {
    console.error("Usage: node scripts/run-workspaces.mjs <script> [--package <name>]");
    process.exit(1);
  }

  const packageFlagIndex = args.indexOf("--package");
  const onlyPackage = packageFlagIndex !== -1 ? args[packageFlagIndex + 1] : undefined;

  const pm = detectPackageManager();
  const allPackages = topoSort(loadPackages());
  const targets = onlyPackage ? allPackages.filter((p) => p.name === onlyPackage) : allPackages;

  if (onlyPackage && targets.length === 0) {
    console.error(`No workspace package named "${onlyPackage}" found.`);
    process.exit(1);
  }

  for (const { dir, name, pkg } of targets) {
    const hasScript = Boolean(pkg.scripts?.[scriptName]);
    if (!hasScript) {
      if (onlyPackage) {
        console.error(`Package "${name}" has no "${scriptName}" script.`);
        process.exit(1);
      }
      continue; // --if-present semantics: silently skip
    }

    console.log(`\n> ${name} ${scriptName} (via ${pm})`);
    const result = spawnSync(pm, ["run", scriptName], {
      cwd: dir,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    if (result.status !== 0) {
      console.error(`\n"${scriptName}" failed in ${name}`);
      process.exit(result.status ?? 1);
    }
  }
}

main();

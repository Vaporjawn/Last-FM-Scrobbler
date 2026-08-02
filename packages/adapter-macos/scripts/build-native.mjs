#!/usr/bin/env node
// Builds vendor/mediaremote-adapter's MediaRemoteAdapter.framework via CMake.
// macOS-only (Objective-C framework linking against private macOS frameworks) — a
// no-op everywhere else, so `npm run build` still succeeds on Linux/Windows CI runners
// and this package's TypeScript still typechecks/lints/tests there. The adapter itself
// (src/index.ts) checks for the built framework at runtime and throws a clear error if
// it's missing, rather than failing silently.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const vendorDir = join(packageDir, "vendor", "mediaremote-adapter");
const buildDir = join(packageDir, "native-build");

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`build-native: "${command}" exited with code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

if (process.platform !== "darwin") {
  console.log(
    "build-native: skipping — MediaRemoteAdapter.framework only builds on macOS " +
      `(current platform: ${process.platform}).`,
  );
  process.exit(0);
}

if (!existsSync(join(vendorDir, "CMakeLists.txt"))) {
  console.error(`build-native: vendored source not found at ${vendorDir}`);
  process.exit(1);
}

run("cmake", ["-S", vendorDir, "-B", buildDir, "-DCMAKE_BUILD_TYPE=Release"]);
run("cmake", ["--build", buildDir]);

const frameworkPath = join(buildDir, "MediaRemoteAdapter.framework");
if (!existsSync(frameworkPath)) {
  console.error(`build-native: expected framework not found at ${frameworkPath}`);
  process.exit(1);
}

console.log(`\nbuild-native: built ${frameworkPath}`);

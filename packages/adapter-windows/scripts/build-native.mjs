#!/usr/bin/env node
// Publishes native/SmtcHelper (a small WinRT-calling console app) to native-build/SmtcHelper.exe
// via `dotnet publish`. Windows-only (WinRT/SMTC has no meaning on other platforms) — a
// no-op everywhere else, so `npm run build` still succeeds on Linux/macOS CI runners and
// this package's TypeScript still typechecks/lints/tests there. The adapter itself
// (src/smtc/create-windows-playback-source.ts) checks for the published exe at runtime
// and throws a clear error if it's missing, rather than failing silently.
//
// Note: the C# source itself is compiled (not just run) as part of ordinary development
// in this repo via `dotnet build` with `EnableWindowsTargeting=true` set in
// SmtcHelper.csproj — see docs/adr/0009-windows-smtc-integration.md for why that flag
// makes real compiler verification of the WinRT API surface possible even on a
// non-Windows development machine. `dotnet publish -r win-x64` (this script) additionally
// needs the actual win-x64 runtime packages, which only fully resolve/work end-to-end on
// Windows or with the Windows workload installed — hence still gating this script to
// `process.platform === "win32"`.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const projectPath = join(packageDir, "native", "SmtcHelper", "SmtcHelper.csproj");
const outDir = join(packageDir, "native-build");

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`build-native: "${command}" exited with code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

if (process.platform !== "win32") {
  console.log(
    `build-native: skipping — SmtcHelper.exe only builds on Windows (current platform: ${process.platform}).`,
  );
  process.exit(0);
}

if (!existsSync(projectPath)) {
  console.error(`build-native: project not found at ${projectPath}`);
  process.exit(1);
}

run("dotnet", [
  "publish",
  projectPath,
  "-c",
  "Release",
  "-r",
  "win-x64",
  "--self-contained",
  "true",
  "-p:PublishSingleFile=true",
  "-o",
  outDir,
]);

const helperPath = join(outDir, "SmtcHelper.exe");
if (!existsSync(helperPath)) {
  console.error(`build-native: expected helper not found at ${helperPath}`);
  process.exit(1);
}

console.log(`\nbuild-native: built ${helperPath}`);

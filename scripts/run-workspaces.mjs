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

import { runWorkspaceScript } from "./workspaces/run-workspace-script.mjs";

runWorkspaceScript(process.argv.slice(2));

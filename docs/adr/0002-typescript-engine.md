# 0002: TypeScript for the scrobbling engine

## Status

Accepted

## Context

Considered TypeScript/Node.js, Rust, and Python for `packages/core` and the OS adapters.
Rust best matches the original project's "native, lightweight" philosophy but iterates
slower (compile times, borrow checker) for a project prioritizing TDD velocity. Python
is fast to write and test but is the weakest fit for "lightweight" (bundled interpreter).

## Decision

TypeScript/Node.js. Fastest TDD loop (Vitest, watch mode, no compile-and-link cycle), a
pure-JS D-Bus client for Linux MPRIS with no native build step, and it lets the Electron
desktop app (ADR 0003) import `packages/core` directly with no IPC boundary.

## Consequences

- Windows (SMTC) and macOS (MediaRemote) still need small compiled native helpers, since
  neither is exposed to JS directly — isolated as their own helper binaries rather than
  Node native addons, to avoid Electron-ABI prebuild pain (see the adapter module docs).
- Full type-safety across the whole stack (engine, adapters' TS side, desktop UI) with
  one toolchain.
- TypeScript is pinned to the 6.0.x line, not the newer 7.x native compiler, because
  `typescript-eslint` (as of 8.65.0) hard-rejects TS 7 outright rather than just warning
  — confirmed by actually running `pnpm lint` against TS 7.0.2 during scaffolding, which
  failed with "typescript-eslint does not support TS 7.0." Revisit once
  typescript-eslint adds TS 7 support (tracked upstream:
  https://github.com/typescript-eslint/typescript-eslint/issues/10940).

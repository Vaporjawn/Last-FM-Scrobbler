# Vendored: mediaremote-adapter

Source: https://github.com/ungive/mediaremote-adapter
Commit: `3ac3d4bdf862c7b5399b4fba4df5689f5c38609a`
License: BSD-3-Clause (see `LICENSE` in this directory)

## Why this is vendored instead of a normal dependency

`MRMediaRemoteGetNowPlayingInfo` (the private, undocumented macOS API this project's
`adapter-macos` needs) has required a special entitlement since macOS 15.4 — calls from
an unentitled process now get `Operation not permitted` straight from `mediaremoted`,
confirmed by live-testing a plain `dlopen`/`dlsym` helper binary on this machine (see
`docs/adr/0008-macos-mediaremote-entitlement.md`). Third-party apps cannot obtain that
entitlement.

This project works around that by using `/usr/bin/perl` — a system binary Apple already
entitles — as a trampoline: it dynamically loads a small compiled framework
(`MediaRemoteAdapter.framework`, built from the source vendored here) that does the
actual `MediaRemote` calls from _within_ the already-entitled `perl` process, and prints
now-playing updates to stdout as JSON. `packages/adapter-macos` spawns
`bin/mediaremote-adapter.pl <built-framework-path> stream` and parses that output.

## What's vendored

Everything needed to build `MediaRemoteAdapter.framework` and run the adapter script:
`CMakeLists.txt`, `include/`, `src/`, `bin/mediaremote-adapter.pl`. The upstream repo's
dev tooling (`.clang-format`, `.vscode/`, `scripts/update-readme-badges.py`, `Makefile`,
its own `README.md`) was left out — none of it is needed to build or run this.

## Updating

Re-copy `CMakeLists.txt`, `include/`, `src/`, and `bin/` from a fresh checkout of the
upstream repo, bump the commit hash above, and re-run
`packages/adapter-macos/scripts/build-native.mjs` to confirm it still builds and (on a
Mac, with something actually playing) still returns real now-playing data.

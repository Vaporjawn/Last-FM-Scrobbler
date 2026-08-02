# `packages/adapter-macos`

## Responsibility

Implements `PlaybackSource` via MediaRemote — a private, undocumented macOS framework
with no public TS/JS binding. Modern macOS (15.4+) also blocks direct calls to it from
any process Apple hasn't specifically entitled, so this adapter spawns
`/usr/bin/perl` (one of the few binaries Apple still entitles) running a vendored,
locally-compiled helper framework as a trampoline, and parses its newline-delimited
JSON stdout. See `docs/adr/0008-macos-mediaremote-entitlement.md` for the full story,
including the live experiment that proved the direct-call approach no longer works, and
`packages/adapter-macos/vendor/mediaremote-adapter/VENDORED.md` for exactly what's
vendored from where.

## Public interface (current)

- `createMacosPlaybackSource(): PlaybackSource` — spawns the perl/framework pipeline
  and maps its output to `TrackInfo`/`PlaybackState` events. Throws a clear,
  actionable error if `MediaRemoteAdapter.framework` hasn't been built yet (run
  `pnpm --filter @lastfm-scrobbler/adapter-macos build:native`, or just `build`, which
  runs it first — macOS + Xcode command line tools + CMake required).
- `NowPlayingStreamParser` — the pure, independently-testable piece that turns raw
  `mediaremote-adapter` stdout lines into `PlaybackSource` events (diff-merging,
  track-identity deduping, position extrapolation from `elapsedTime`/`timestamp`).

## Dependencies

- `@lastfm-scrobbler/shared-types` (the `PlaybackSource` type).
- `/usr/bin/perl` at runtime (ships with macOS).
- `cmake` + Xcode command line tools at build time, to compile the vendored
  `MediaRemoteAdapter.framework` (macOS-only; `scripts/build-native.mjs` no-ops on
  other platforms so the rest of the workspace is unaffected).

## Status

Fully implemented and live-verified end-to-end against a real, actively-playing Apple
Music session on macOS 27.0 (build 26A5388g): the built framework, spawned through
`createMacosPlaybackSource()`, returned correct title/artist/album/duration/elapsedTime
and correct `playing` transitions across a real track change. Unit-tested
(`NowPlayingStreamParser`, using real captured fixture lines) plus a platform-gated
integration smoke test (`tests/mediaremote-adapter.smoke.test.ts`) that exercises the
real perl/framework pipeline when run on macOS with the framework built. Not yet
independently live-verified against Spotify specifically (not running during
verification) — MediaRemote is app-agnostic by design, so this is expected to work
without adapter-specific changes, but that expectation hasn't been directly confirmed.

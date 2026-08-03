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
vendored from where (upstream: https://github.com/ungive/mediaremote-adapter,
BSD-3-Clause).

## Module layout (`src/media-remote/`)

- `create-macos-playback-source.ts` — `createMacosPlaybackSource(options?):
  PlaybackSource`, the composition root. On construction, resolves this package's own
  root directory (`findPackageRoot`, below) and confirms
  `native-build/MediaRemoteAdapter.framework` exists, throwing synchronously and
  immediately if either fails — both are static, environment-level preconditions worth
  failing fast on regardless of whether anyone ever subscribes. The actual
  `perl vendor/mediaremote-adapter/bin/mediaremote-adapter.pl <framework-path> stream`
  child process is spawned **lazily on first subscription** and torn down once every
  subscriber has unsubscribed (`subscriberCount` tracked internally,
  `stopIfNoSubscribers`) — matching `adapter-linux`/`adapter-windows`'s lifecycle.
  This wasn't always true: the process used to spawn unconditionally inside this
  function and was never torn down, so any caller that constructed a source without
  ever subscribing (an adapter-availability probe, code that tries several adapters and
  discards the unused ones) leaked an orphaned perl process and native framework handle
  for the app's entire remaining lifetime. The spawned child's `exit` handler similarly
  used to be entirely unhandled — if the perl process crashed or was killed after
  starting successfully, the `readline` pipeline just stopped emitting lines with no
  signal, silently freezing the parser on stale state forever; now `child` is cleared on
  exit (guarded against a stale exit notification for an already-replaced process) so a
  later `ensureStarted()` call can actually respawn it, and a non-zero/non-null exit
  code is reported through `onError`. `options.spawnImpl`/`options.onError` are
  injectable for testing; `onError` defaults to logging via `console.error`.
- `now-playing-stream-parser.ts` — `NowPlayingStreamParser`, kept deliberately separate
  from process-spawning so the parsing logic is testable without a real
  macOS/perl/framework in the loop. `handleLine(line)` feeds one raw stdout line;
  `mediaremote-adapter`'s stream protocol sends either a full payload or a `diff`
  (merged onto the last known payload) per JSON line. Two edge cases fixed here, both
  found by reading the vendored native adapter's own diff-generation code
  (`stream.m`'s `createDiff`) rather than guessing at the wire format:
  - A JSON `null` for `duration`/`elapsedTime` is a real, observed diff shape (the
    native side emits `NSNull` for a momentarily-disappeared field while track identity
    stays the same) — a naive `!== undefined` check lets `null` through as if it were a
    real number, which JS then silently coerces to `0` in arithmetic
    (`Math.min(position, null)` → `0`). `toTrackInfo`'s `durationSec` and
    `getPosition`'s `elapsedTime` handling both explicitly check `typeof x === "number"`
    instead, treating a `null` diff value the same as "still unknown" rather than "now
    zero".
  - `getPosition()` extrapolates from `elapsedTime` + `timestamp` + `playbackRate` when
    currently playing (the payload's position is only as fresh as the last poll, not
    live), clamped to `[0, duration]`.
  - A track with no `title` is treated as "nothing playing" by design (matches the
    vendored adapter's own convention) — `toTrackInfo` returns `undefined` for it, which
    the parser reads as the track having ended (`hasTrack = false`), driving
    `PlaybackState` to `"stopped"`.
  - `sourceApp` is the reported `bundleIdentifier`, falling back to the literal string
    `"unknown"` if absent. `isStream` is true when either `radioStationIdentifier` or
    `radioStationHash` is present in the payload.
- `find-package-root.ts` — `findPackageRoot(startDir): string | null`. Walks **upward**
  from `startDir` until a directory containing a `package.json` is found, rather than
  assuming a fixed number of `".."` traversals from `import.meta.url`. This is a real,
  previously-hit bug class, not defensive theorizing: a fixed-depth traversal looks
  correct when checked against the *source* file's location in `src/media-remote/`, but
  silently breaks once `tsup` bundles every source file into one flat `dist/index.js`
  (always exactly one level deep from the package root, regardless of how deeply the
  original source was nested) — a prior refactor that moved this code one level deeper
  into a subdirectory adjusted the traversal count to match the new *source* depth,
  which was correct for tests (which import the source directly) but wrong for the
  *bundled* output every real consumer actually uses, silently pointing every real
  caller at the wrong `native-build/` directory. Walking upward for the nearest
  `package.json` works identically for both cases — the same pattern
  `packages/adapter-windows/src/smtc/resolve-helper-path.ts` uses for the identical
  underlying problem.
- `adapter-macos-package-root-not-found-error.ts` —
  `AdapterMacosPackageRootNotFoundError`, thrown by `createMacosPlaybackSource` when
  `findPackageRoot` returns `null` (no `package.json` found walking upward from the
  running code's own directory) — in practice, only reachable if the package's on-disk
  layout changes in a way that breaks the assumption entirely.
- `src/index.ts` — the package's public export surface:
  `createMacosPlaybackSource`, `NowPlayingStreamParser`,
  `AdapterMacosPackageRootNotFoundError`.

## Public interface (current)

- `createMacosPlaybackSource(options?): PlaybackSource` — see above. Throws a clear,
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
(`NowPlayingStreamParser`, using real captured fixture lines;
`create-macos-playback-source.test.ts` for the lazy-spawn/teardown/exit-handling
lifecycle via an injected fake `spawn`; `find-package-root.test.ts` for the upward-walk
logic) plus a platform-gated integration smoke test
(`tests/mediaremote-adapter.smoke.test.ts`) that exercises the real perl/framework
pipeline when run on macOS with the framework built. Not yet independently
live-verified against Spotify specifically (not running during verification) —
MediaRemote is app-agnostic by design, so this is expected to work without
adapter-specific changes, but that expectation hasn't been directly confirmed.

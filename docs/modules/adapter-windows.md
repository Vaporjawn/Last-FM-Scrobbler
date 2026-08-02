# `packages/adapter-windows`

## Responsibility

Implements `PlaybackSource` via SMTC (System Media Transport Controls —
`Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager`, WinRT). No
Node.js binding exists for WinRT APIs, so this talks to SMTC through a small compiled
C# helper (`native/SmtcHelper/`) that prints JSON events on stdout — architecturally
the same shape as `adapter-macos`, though for a different underlying reason (SMTC has
no entitlement lockdown the way MediaRemote does; it's simply not exposed to
JavaScript at all). See docs/adr/0009-windows-smtc-integration.md.

## Public interface (current)

- `createWindowsPlaybackSource(options?): PlaybackSource` — spawns the compiled helper
  lazily on first subscription (torn down once every subscriber unsubscribes), and maps
  its JSON stdout to `TrackInfo`/`PlaybackState` events. Throws `SmtcHelperNotBuiltError`
  if `SmtcHelper.exe` hasn't been published yet (run
  `pnpm --filter @lastfm-scrobbler/adapter-windows build:native`, or just `build`, which
  runs it first — Windows + the .NET 8 SDK required). `options.spawnImpl`/
  `options.resolveHelperPathImpl` are injectable for testing.

Unlike `adapter-linux`, there's no `PlayerRegistry`/multi-source arbitration policy
here: SMTC's `GetCurrentSession()` already decides which running session is "the
current session" the user would most likely want to control, so this adapter just
reports whatever SMTC itself reports.

### Module layout

- `native/SmtcHelper/Program.cs` — the C# helper: connects to
  `GlobalSystemMediaTransportControlsSessionManager`, re-subscribes to the current
  session's `MediaPropertiesChanged`/`PlaybackInfoChanged`/`TimelinePropertiesChanged`
  events whenever `CurrentSessionChanged` fires, and prints one JSON line (or `null`)
  per update.
- `scripts/build-native.mjs` — `dotnet publish`s the helper to
  `native-build/SmtcHelper.exe`; a no-op on non-Windows platforms.
- `src/smtc/now-playing-payload.ts` — the raw JSON shape from the helper.
- `src/smtc/map-payload-to-track-info.ts` / `map-payload-to-playback-state.ts` — pure
  payload mappers.
- `src/smtc/parse-stream-line.ts` — parses one stdout line into a payload object,
  `null` (nothing is the current session — a real, meaningful state), or `undefined`
  (unparseable — skip, don't change state).
- `src/smtc/resolve-helper-path.ts` — locates `native-build/SmtcHelper.exe` relative
  to the package root.
- `src/smtc/spawn-smtc-helper.ts` — spawns the helper directly (no trampoline process
  needed, unlike macOS) and parses its stdout.
- `src/smtc/create-windows-playback-source.ts` — composes all of the above into the
  public `PlaybackSource`.

## Dependencies

- `@lastfm-scrobbler/shared-types` (the `PlaybackSource` type).
- The .NET 8 SDK at build time, to compile/publish the helper (Windows-only).
- No runtime Node.js dependencies — the helper is a self-contained published
  executable.

## Status

The TypeScript side is fully implemented and tested (37 tests: payload mappers, stream
parsing, process lifecycle, all via an injected fake `spawn`) — genuinely testable
without Windows, since it's all JSON parsing and process management.

The C# helper (`native/SmtcHelper/Program.cs`) is **compiler-verified but not
execution-verified**: `dotnet build` with `EnableWindowsTargeting=true` restores and
compiles it against real WinRT projection metadata even on macOS (confirmed working in
this development environment — see docs/adr/0009-windows-smtc-integration.md for how),
so every WinRT method/property/event name used has been checked against the real API
surface, not just documentation. What could **not** be verified in this environment:
that the published executable actually runs and correctly reports real SMTC sessions —
that requires a real Windows machine, which wasn't available here. `npm run build`'s
`build:native` step will attempt a real `dotnet publish -r win-x64` the next time CI's
`windows-latest` matrix job runs, which will be the first real signal on whether the
publish step itself succeeds (a different question from whether the running helper
behaves correctly, which still needs manual testing on Windows).

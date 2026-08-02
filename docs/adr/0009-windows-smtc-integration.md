# 0009: Windows SMTC integration via a compiled WinRT helper process

## Status

Accepted

## Context

`packages/adapter-windows` needs system-wide now-playing state on Windows. The
relevant API is `Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager`
("SMTC" / "GSMTC") — a WinRT API with no Node.js binding, so some form of native or
helper-process bridge is required (the same fundamental shape of problem as
`packages/adapter-macos`, see docs/adr/0008-macos-mediaremote-entitlement.md, though the
underlying cause is different — SMTC has no entitlement lockdown; it's simply not
exposed to JavaScript at all).

Options considered:

- **A prebuilt native N-API addon** (e.g. `@coooookies/windows-smtc-monitor`). Rejected:
  platform-specific compiled binaries per architecture, and — like any third-party
  native addon — opaque to audit without decompiling it.
- **An existing "stdio bridge to a .NET backend" package** (`windows-media-sessions` on
  npm). This is architecturally the right shape (matches the perl-trampoline pattern
  used for macOS), but was rejected as a dependency: 2 GitHub stars, created about two
  months before this was written, single maintainer, no independent verification found.
  For macOS, vendoring `ungive/mediaremote-adapter` was justified by strong corroborating
  evidence (cross-referenced by a second independent project, actively tested against
  recent macOS versions, and independently live-verified in this repo against real
  Apple Music). No comparable confidence exists for this Windows package.
- **A small first-party C# console helper**, using only the public, fully-documented
  `Windows.Media.Control` WinRT API. Chosen: auditable (the source is ~150 lines, all in
  this repo), uses a stable public API (not reverse-engineered), and — see below — was
  possible to genuinely compiler-verify despite having no Windows machine available in
  this development environment.

## Decision

`packages/adapter-windows/native/SmtcHelper` is a small C# console app
(`net8.0-windows10.0.19041.0`) that calls `GlobalSystemMediaTransportControlsSessionManager`
directly (no trampoline needed — SMTC has no entitlement check to route around) and
prints one line of JSON per now-playing update to stdout, or the literal `null` when
nothing is the current session. `packages/adapter-windows/src/smtc/` spawns the
published executable and parses that stream — architecturally the same shape as
`packages/adapter-macos` (pure payload mappers + a spawn wrapper + a composing
`PlaybackSource` factory), but without a `PlayerRegistry`: SMTC itself decides which
session is "current" (`GetCurrentSession()`), unlike MPRIS on Linux where this project
has to implement that arbitration itself (see
docs/adr/0005-multi-source-and-track-identity-policy.md and `packages/adapter-linux`'s
`PlayerRegistry`).

### Real compiler verification without a Windows machine

`SmtcHelper.csproj` sets `EnableWindowsTargeting=true`, which lets `dotnet build` restore
and compile against `net8.0-windows10.0.19041.0` on a non-Windows host — this was
verified directly in this development environment (macOS): a plain
`net8.0-windows10.0.19041.0` project fails with `NETSDK1100` without the flag, and
succeeds with it, producing real compiler errors (not just "can't find this platform")
against the actual WinRT projection metadata for missing `using` directives, wrong
method signatures, etc. Every method, property, and event name used in `Program.cs`
was additionally cross-checked against the current Microsoft Learn API reference for
`GlobalSystemMediaTransportControlsSessionManager`,
`GlobalSystemMediaTransportControlsSession`,
`GlobalSystemMediaTransportControlsSessionMediaProperties`,
`GlobalSystemMediaTransportControlsSessionPlaybackInfo`, and
`GlobalSystemMediaTransportControlsSessionTimelineProperties` before being used, and the
final `Program.cs` compiles cleanly (`dotnet build`, 0 warnings, 0 errors) against the
real WinRT metadata on this machine.

What this does **not** prove: that the compiled executable actually *runs* correctly.
WinRT COM activation only works on a real Windows Runtime, which doesn't exist on
macOS — `dotnet publish -r win-x64` (`scripts/build-native.mjs`) and any execution of
the resulting `SmtcHelper.exe` genuinely require Windows and were not (and could not be)
exercised in this development environment. This is a materially different confidence
level than `packages/adapter-macos` and `packages/adapter-linux`, both of which were
live-verified end-to-end against real playback sessions.

### App capability note

Microsoft's own reference docs list `globalMediaControl` as a required "app capability"
for these APIs. Historically, unpackaged Win32/.NET apps (not distributed via
MSIX/Microsoft Store) have been able to call SMTC without declaring any capability —
the restriction appears to target Store-submitted packaged apps specifically — but this
could not be confirmed by direct testing here. If real-world testing on Windows finds
the helper is blocked, declaring `globalMediaControl` in an app manifest (requiring
packaging as MSIX) would be the fallback; that is not implemented, since it's a
substantial architecture change this project doesn't yet know it needs.

## Consequences

- `packages/adapter-windows` has a Windows-only native build step
  (`node scripts/build-native.mjs`, wired into its `build` script, requiring the .NET 8
  SDK), mirroring `packages/adapter-macos`'s pattern. The script is a no-op on
  macOS/Linux so the rest of the workspace's build/typecheck/lint/test pipeline is
  unaffected there.
- The published `native-build/SmtcHelper.exe` is a build artifact, gitignored (as is
  `native/SmtcHelper/bin|obj`, `dotnet build`'s intermediate output).
- Unlike the macOS and Linux adapters, this one is **not** live-verified against a real
  playback session — only compiler-verified against real WinRT metadata and unit-tested
  (TypeScript side: payload mapping, stream parsing, process lifecycle — all fully
  testable without Windows). Real end-to-end verification (does a published
  `SmtcHelper.exe` actually run, does it see real Spotify/Windows Media Player sessions,
  does the `globalMediaControl` capability question above actually matter in practice)
  is a genuine open item, to be done on real Windows hardware or a CI `windows-latest`
  runner.

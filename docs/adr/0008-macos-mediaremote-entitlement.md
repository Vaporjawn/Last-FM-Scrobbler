# 0008: macOS MediaRemote access via a `perl`-hosted helper framework

## Status

Accepted

## Context

`packages/adapter-macos` needs `MRMediaRemoteGetNowPlayingInfo` — part of
`MediaRemote.framework`, a private, undocumented macOS framework with no public header.
The originally scaffolded plan (see `docs/modules/adapter-macos.md`'s original text)
was a small compiled Swift helper binary that `dlopen`/`dlsym`s the framework directly
and prints now-playing JSON to stdout.

That doesn't work anymore. Live-tested against a real, currently-playing track on this
machine (macOS 27), a plain `dlopen`/`dlsym` helper — compiled, ad-hoc signed, or signed
with `com.apple.private.mediaremote` declared (which gets the process killed outright,
since AMFI validates that entitlement against Apple's own signing authority, not just
its presence in the binary's plist) — gets nothing back:

```
mediaremoted: [com.apple.amp.mediaremote:rr] Response: ... returned with error
<Error Domain=kMRMediaRemoteFrameworkErrorDomain Code=3 "Operation not permitted" ...>
for [...] Music [...]
mediaremoted: [...] Adding client <MRDMediaRemoteClient ..., bundleIdentifier =
debug-helper, pid = ..., entitlements=0>
```

Apple locked this down starting macOS 15.4: `mediaremoted` now checks the calling
client's entitlements and rejects unentitled processes with `entitlements=0`. That
entitlement is Apple-private and not obtainable by any third-party Developer ID or
ad-hoc signed binary — this isn't a bug in a specific implementation, it's enforced by
the OS.

## Decision

Use [`ungive/mediaremote-adapter`](https://github.com/ungive/mediaremote-adapter)
(BSD-3-Clause), vendored at `packages/adapter-macos/vendor/mediaremote-adapter/` — see
`VENDORED.md` there for exactly what's vendored and how to update it. It works around
the entitlement check by using `/usr/bin/perl` — a system binary Apple already entitles
— as a trampoline: `mediaremote-adapter.pl` dynamically loads a small compiled
framework (built from the vendored source via CMake,
`packages/adapter-macos/scripts/build-native.mjs`) that makes the actual `MediaRemote`
calls _from within_ the already-entitled `perl` process. `mediaremoted` only ever sees
`perl` as the caller, so the entitlement check passes.

Live-verified end to end on this machine: built the framework, spawned
`perl mediaremote-adapter.pl <framework> stream` from `createMacosPlaybackSource()`,
and got real, correct now-playing data and playback-state transitions back while
Music.app played a queue (title/artist/album/duration/elapsedTime, `playing` toggling
correctly across a track change).

## Consequences

- `packages/adapter-macos` now has a real native build step
  (`node scripts/build-native.mjs`, wired into its `build` script) requiring CMake and
  Xcode command line tools — macOS-only; the script is a no-op on Linux/Windows so
  `npm run build` still succeeds there for the rest of the workspace, matching what
  `docs/modules/adapter-macos.md` already anticipated ("real-API smoke tests... gated
  to macos-latest in CI, which also needs an Xcode toolchain").
- The compiled `MediaRemoteAdapter.framework` output
  (`packages/adapter-macos/native-build/`) is a build artifact, not committed —
  gitignored alongside `dist/`/`out/`.
- This is still a private-API workaround, just one that currently works instead of one
  that's been closed off. If Apple closes this specific loophole too (blocking `perl`
  from receiving the entitlement, or removing the framework-loading mechanism this
  relies on), `packages/adapter-macos` breaks again and needs a new approach — this is
  inherent to reading OS-wide now-playing state without a documented, stable public
  API, not something this project can fully insulate against.
- Vendoring instead of depending on it as a normal npm package because it isn't
  published as one — it's a C/Objective-C CMake project plus a Perl script, not a JS
  package.

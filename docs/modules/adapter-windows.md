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
  `options.resolveHelperPathImpl`/`options.onStderr`/`options.onError` are injectable
  for testing.

Unlike `adapter-linux`, there's no `PlayerRegistry`/multi-source arbitration policy
here: SMTC's `GetCurrentSession()` already decides which running session is "the
current session" the user would most likely want to control, so this adapter just
reports whatever SMTC itself reports.

### Module layout

- `native/SmtcHelper/Program.cs` — the C# helper (`net8.0-windows10.0.19041.0`, ~150
  lines): connects to `GlobalSystemMediaTransportControlsSessionManager`, re-subscribes
  to the current session's `MediaPropertiesChanged`/`PlaybackInfoChanged`/
  `TimelinePropertiesChanged` events whenever `CurrentSessionChanged` fires (via
  `AttachToCurrentSessionAsync`), builds a `NowPlayingSnapshot` from whatever the
  session currently reports (`BuildSnapshotAsync`), and prints one JSON line (or the
  literal `null`, when there's no current session) per update via `EmitSnapshot`. WinRT
  event handlers that are `async` compile to fire-and-forget `async void` under the
  hood — every handler here is wrapped through a `SafeAsync` helper specifically to
  avoid an unobserved exception silently killing the process.
- `scripts/build-native.mjs` — `dotnet publish`s the helper to
  `native-build/SmtcHelper.exe`; a no-op on non-Windows platforms.
- `src/smtc/now-playing-payload.ts` — `NowPlayingPayload`, the raw JSON shape the
  helper emits: `title`/`artist`/`album`/`albumArtist` (nullable strings),
  `durationSec`/`elapsedSec` (nullable numbers, already in seconds — no unit
  conversion needed on the TS side), `playbackStatus` (the C# enum member name as a
  string literal: `"Closed" | "Opened" | "Changing" | "Stopped" | "Playing" |
  "Paused"`), and `sourceAppUserModelId` (the owning app's Application User Model ID,
  e.g. `"Spotify.exe"`).
- `src/smtc/map-payload-to-track-info.ts` — `mapPayloadToTrackInfo(payload): TrackInfo
  | null`. Returns `null` when either `title` or `sourceAppUserModelId` is missing —
  unlike macOS's MediaRemote, SMTC's `MediaProperties` has no field that's
  spec-guaranteed non-null, so both are treated as mandatory defensively.
  `durationSec` is only kept when it's a positive number (a reported `0` is treated as
  "unknown", not "zero-length track"). `isStream` is always `false` — SMTC has no
  dedicated "this is a live stream/radio" field the way MediaRemote does
  (`radioStationIdentifier`/`radioStationHash`); deriving it from "no duration
  reported" used to misclassify an ordinary track queried before
  `TimelineProperties` populates as a stream (the exact same content was correctly
  `isStream: false` on macOS at the same moment) — `false` is now the honest default
  rather than conflating "duration unknown" with "is a stream" just because this
  adapter has no real signal for the latter (mirrors the identical fix in
  `adapter-linux`'s MPRIS mapper).
- `src/smtc/map-payload-to-playback-state.ts` — `mapPayloadToPlaybackState(payload):
  PlaybackState`. Only `"Playing"`/`"Paused"` map to their obvious counterparts;
  everything else — including SMTC's three transitional/inactive statuses
  (`"Closed"`/`"Opened"`/`"Changing"`) this project has no use for — maps to
  `"stopped"` rather than guessing.
- `src/smtc/parse-stream-line.ts` — `parseStreamLine(line): NowPlayingPayload | null |
  undefined`. Three-way return distinguishes a real payload, SMTC's own "nothing is
  the current session" signal (`null`), and an unparseable line (`undefined` — blank
  lines, malformed JSON, a stray diagnostic string), so a single bad line can never be
  mistaken for "nothing playing" and silently clear real state.
- `src/smtc/spawn-smtc-helper.ts` — `spawnSmtcHelper(options): SmtcHelperHandle`.
  Spawns the helper directly (no trampoline process needed, unlike macOS) and wires its
  stdout through `parseStreamLine` into `options.onEvent`. Always attaches a
  `child.on("error", ...)` listener, even when no `options.onError` was given — Node's
  `ChildProcess` is an `EventEmitter` that throws on an unhandled `'error'` event by
  default, which would crash the entire Electron main process on a spawn failure (a
  missing/misplaced exe, wrong architecture, blocked by antivirus). This is explicitly
  called out in the option's own docstring as the single highest-risk untested path in
  this adapter, since process-spawn failure has never actually been exercised against
  a real Windows machine in this development environment.
- `src/smtc/resolve-helper-path.ts` — `resolveHelperPath(startDir): ResolvedHelperPath`
  (`{ helperPath, helperBuilt }`). Locates `native-build/SmtcHelper.exe` by walking
  **upward** from `startDir` until a directory containing `package.json` is found,
  rather than assuming a fixed number of `".."` traversals — the traversal count that
  looks right against this file's own source location silently breaks once `tsup`
  bundles everything into a flat `dist/index.js` one level deep from the package root
  regardless of how nested the original source was. This is the same fix
  `packages/adapter-macos/src/media-remote/find-package-root.ts` independently needed
  for the identical underlying problem — see that module's own doc for the concrete
  bug this class of fix prevents.
- `src/smtc/adapter-windows-package-root-not-found-error.ts` —
  `AdapterWindowsPackageRootNotFoundError`, thrown by `resolveHelperPath` when no
  `package.json` is found walking upward.
- `src/smtc/smtc-helper-not-built-error.ts` — `SmtcHelperNotBuiltError`, thrown by
  `createWindowsPlaybackSource` when `resolveHelperPath` reports `helperBuilt: false`.
- `src/smtc/create-windows-playback-source.ts` — composes all of the above into the
  public `PlaybackSource`, plus two behaviors not obvious from the individual pieces:
  - **Event deduplication.** SMTC fires `TimelinePropertiesChanged` on ordinary
    playback-position ticks (roughly once per second for most players), not just on
    genuine track/state changes — unlike this adapter, both siblings (macOS/
    MediaRemote, Linux/MPRIS) already dedupe before notifying listeners. Without this,
    a single 4-minute song used to fire `onTrackChanged` roughly 240 times and
    `onPlaybackStateChanged("playing")` repeatedly with no real change, spamming any
    consumer that treats either event as "something actually changed" (a Last.fm
    now-playing update, a scrobble-eligibility timer reset). `trackInfoEqual` (a
    field-by-field structural compare) and a `lastEmittedState` baseline now gate every
    emission.
  - **Respawn after crash.** The helper process's handle is captured by reference
    inside its own `onExit` callback (rather than reading the outer `helperHandle`
    variable directly), so a *stale* exit notification — the old process's `exit`
    event finally firing after a stop-then-immediate-restart has already assigned a
    new handle — can't clobber the live handle. Without this, a crashed/killed helper
    left the adapter permanently stuck reporting the last-known (stale) track/state
    with nothing logged or surfaced anywhere; now a later `ensureStarted()` call (the
    next subscription) can actually respawn it. `stopIfNoSubscribers` also clears the
    dedup baseline (`lastEmittedTrack`/`lastEmittedState`) on teardown, so a later
    restart doesn't skip re-emitting the first track/state it sees just because it
    happens to match whatever was last reported before the stop.

## Dependencies

- `@lastfm-scrobbler/shared-types` (the `PlaybackSource` type).
- The .NET 8 SDK at build time, to compile/publish the helper (Windows-only).
- No runtime Node.js dependencies — the helper is a self-contained published
  executable.

## Status

The TypeScript side is fully implemented and tested (payload mappers, stream parsing,
process lifecycle including the dedup and respawn behaviors above, package-root
resolution — all via an injected fake `spawn`) — genuinely testable without Windows,
since it's all JSON parsing and process management.

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
behaves correctly, which still needs manual testing on Windows). `spawnSmtcHelper`'s
`onError` path (spawn failure — missing exe, wrong architecture, blocked by
antivirus) is the single highest-risk untested behavior specifically, per that
option's own docstring.

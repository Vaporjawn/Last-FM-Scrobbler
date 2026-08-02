# `packages/adapter-linux`

## Responsibility

Implements `PlaybackSource` via MPRIS2 over D-Bus (`org.mpris.MediaPlayer2.Player`).
Pure JS (`dbus-next`), no native build step — works with VLC, Rhythmbox, the Spotify
Linux client, browsers with MPRIS extensions, and anything else that registers an MPRIS
player. Unlike macOS's MediaRemote, MPRIS2 is a documented, public, unrestricted D-Bus
interface — no private-API workarounds needed.

## Public interface (current)

- `createLinuxPlaybackSource(options?): PlaybackSource` — connects to the D-Bus session
  bus lazily on first subscription (disconnecting once every subscriber unsubscribes),
  discovers running MPRIS players, and tracks them all simultaneously.
  `options.sessionBus`/`options.now` are injectable for testing;
  `options.onError` receives non-fatal per-player errors (e.g. a player that vanishes
  mid-connect — normal desktop lifecycle, not treated as fatal).
- `PlayerRegistry` — the pure (no D-Bus dependency) multi-source arbitration state
  machine implementing docs/adr/0005-multi-source-and-track-identity-policy.md:
  whichever player is `Playing` and most recently _started_ wins; if none are playing,
  the most recently _changed_ player's state is reported.

### Module layout (`src/mpris/`)

- `map-metadata-to-track-info.ts` / `map-playback-status.ts` — pure payload mappers
  (MPRIS `Metadata`/`PlaybackStatus` → `TrackInfo`/`PlaybackState`), including
  Variant-unwrapping and tolerance for nonconformant players (e.g. a plain-string
  `xesam:artist` instead of the spec'd string array).
- `derive-source-app-from-bus-name.ts` — bus name → `TrackInfo.sourceApp` (strips the
  `org.mpris.MediaPlayer2.` prefix and any `.instanceN` multi-instance suffix).
- `player-registry.ts` — the arbitration policy above.
- `mpris-player-bus-names.ts` — lists running MPRIS players and watches
  `NameOwnerChanged` for players starting/stopping.
- `watch-mpris-player.ts` — connects to one player, does the initial property fetch,
  subscribes to `PropertiesChanged`.
- `query-mpris-position.ts` — on-demand `Position` query (MPRIS explicitly documents
  `Position` as unsuitable for push notifications).
- `call-dbus-method.ts` — small shared helper working around `noUncheckedIndexedAccess`
  making `dbus-next`'s `ClientInterface` index-signature method calls look possibly
  `undefined` to TypeScript.
- `create-linux-playback-source.ts` — composes all of the above into the public
  `PlaybackSource`.

## Dependencies

- `@lastfm-scrobbler/shared-types` (the `PlaybackSource` type).
- `dbus-next` (pure JS + one native helper, `usocket`, for the raw D-Bus socket —
  approved in `pnpm-workspace.yaml`'s `allowBuilds`).
- `dbus-daemon` at test time only, for the real-pipeline smoke test (see Status).

`dbus-next`'s own dependency tree is the reason the root `package.json`/
`pnpm-workspace.yaml` carry an `overrides` block at all — `npm audit --omit=dev` once
reported 10 vulnerabilities (3 critical) reachable through it. See
`docs/adr/0010-dbus-next-transitive-vulnerability-audit.md` for the full reachability
investigation and why the audit is clean now.

## Status

Fully implemented and tested: 45 tests across the pure mappers, `PlayerRegistry`'s
arbitration policy (including simultaneous-playing and re-resume-after-pause
scenarios), and the D-Bus composition layer (via an injected fake bus). Additionally
live-verified against a **real** D-Bus pipeline —
`tests/mpris/mpris-adapter.smoke.test.ts` spawns its own throwaway `dbus-daemon`,
registers a real MPRIS2 service on it via `dbus-next`'s own service API (a second,
independent connection — not a mock of this project's code), and confirms
`createLinuxPlaybackSource()` correctly discovers it, reports its real initial
metadata, and reacts to live `PropertiesChanged` signals for both a track change and a
playback-state change — genuine wire-protocol coverage, not mocked-in-process. Skips
itself (rather than failing) if `dbus-daemon` isn't available; CI installs it
defensively on `ubuntu-latest` to make sure that never happens there. Not yet
live-verified against a real third-party player (VLC/Spotify) specifically — only
against this project's own real-protocol mock — since no Linux machine was available
in this development environment.

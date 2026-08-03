# `packages/shared-types`

## Responsibility

Shared types and the `PlaybackSource` interface every OS adapter
(`packages/adapter-{macos,windows,linux}`) implements and that `packages/core`
depends on instead of any concrete adapter — the seam that keeps the engine
(`packages/core`) fully decoupled from *how* now-playing state is actually obtained on
any given OS (see `docs/adr/0001-standalone-os-media-session-architecture.md` and
`docs/adr/0002-typescript-engine.md`). The whole package is four tiny files, no runtime
code at all — purely declarations.

## Module layout

- `track-info.ts` — `TrackInfo`, the normalized shape every adapter maps its OS-native
  now-playing payload into:
  - `title` / `artist` — always present; the two fields every media-session API
    guarantees in some form.
  - `album?` / `albumArtist?` — optional; not every source (a browser tab, a podcast
    app) reports these.
  - `durationSec?` — optional; omitted for sources with no fixed length (a live radio
    stream) — `packages/core`'s `rules/is-eligible-for-scrobble.ts` and
    `rules/is-likely-non-music-video.ts` both branch on its absence specifically.
  - `sourceApp` — always present; identifies *which* application is playing (a macOS
    bundle ID, a Linux MPRIS bus name suffix, a Windows AUMID — exact shape is
    adapter- and platform-specific, see each adapter's own module doc). Drives the
    filter DSL's `sourceApp` field and the non-music-video heuristic's browser-token
    check.
  - `isStream` — whether this is a live/indefinite-length source (no natural "end", so
    some UI/scrobbling behavior treats it differently than a fixed-length track).
- `playback-state.ts` — `PlaybackState = "playing" | "paused" | "stopped"`. Three
  states only — no "buffering"/"loading" distinction, since no target OS media-session
  API reliably exposes one distinct from "paused" in a way this project's adapters
  could act on differently anyway.
- `playback-source.ts` — the interface itself:
  - `Unsubscribe = () => void` — the return type of both subscription methods below;
    every adapter's subscribe call must return one, and every caller (chiefly
    `packages/core`'s `Tracker.stop()`) relies on being able to call it to fully tear
    down a subscription.
  - `PlaybackSource`:
    - `onTrackChanged(callback: (track: TrackInfo) => void): Unsubscribe` — fires
      whenever the currently-playing track changes (a new track starts, or playback
      switches to a different source entirely — see each adapter's own
      multi-source-arbitration behavior, e.g. `adapter-linux`'s `PlayerRegistry`).
    - `onPlaybackStateChanged(callback: (state: PlaybackState) => void): Unsubscribe`
      — fires on play/pause/stop transitions independent of track changes.
    - `getPosition(): Promise<number>` — on-demand playback position in seconds, for
      callers that need "how far into this track are we right now" without waiting for
      a push event (none of the underlying OS APIs push position updates on every
      tick — MPRIS explicitly documents its own `Position` property as unsuitable for
      that, hence a pull method here rather than a third `onPositionChanged` event).
- `index.ts` — the package's only export surface: re-exports `PlaybackSource`,
  `Unsubscribe`, `PlaybackState`, and `TrackInfo` as types (`export type { ... }` —
  nothing here has a runtime value to export, since the interface itself is only ever
  implemented by adapter code, never instantiated by this package).

## Design note: why this is a separate package at all

Everything here could technically live inside `packages/core` instead. It's split out
so that each adapter package's `package.json` can depend on exactly this — a
zero-runtime-code, pure-declarations package — without pulling in `core`'s actual
dependencies (`better-sqlite3` and everything `core` itself imports transitively). An
adapter has no reason to depend on the scrobble queue, the Last.fm client, or the
filter DSL; it only needs to know the *shape* it must produce.

## Dependencies

None — pure type declarations, no runtime code, no external packages (not even
`@lastfm-scrobbler/core`, deliberately — see above).

## Status

Complete for the current design. Type-only, so there's no runtime behavior to unit
test; verified via `tsc --noEmit`. Consumed identically by all three adapters
(`packages/adapter-macos`, `packages/adapter-windows`, `packages/adapter-linux`) and by
`packages/core`'s `tracker/tracker.ts`, so any breaking change here is a breaking
change to every one of those packages simultaneously — verified by the fact that the
whole workspace's `build` step topologically sorts on this package first (see
`docs/adr/0007-package-manager-agnostic.md`'s description of
`scripts/run-workspaces.mjs`).

# `packages/shared-types`

## Responsibility

Shared types and the `PlaybackSource` interface every OS adapter implements and that
`packages/core` depends on instead of any concrete adapter.

## Public interface

- `TrackInfo` — title, artist, album, albumArtist, durationSec, sourceApp, isStream.
- `PlaybackState` — `"playing" | "paused" | "stopped"`.
- `PlaybackSource` — `onTrackChanged`/`onPlaybackStateChanged` (each returns an
  unsubscribe function) and `getPosition(): Promise<number>`.

## Dependencies

None — pure type declarations, no runtime code, no external packages.

## Status

Complete for the current design. Type-only, so there's no runtime behavior to unit
test; verified via `tsc --noEmit`.

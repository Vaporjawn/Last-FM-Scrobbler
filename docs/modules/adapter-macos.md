# `packages/adapter-macos`

## Responsibility

Implements `PlaybackSource` via MediaRemote — a private, undocumented macOS framework
with no public TS/JS binding, so this adapter shells out to a small compiled Swift
helper binary that prints JSON events on stdout. Keeps the fragile, unofficial-API
surface tiny, isolated, and independently replaceable if Apple changes MediaRemote.

## Public interface (current)

- `createMacosPlaybackSource(): PlaybackSource` — currently throws
  "not implemented yet"; the Swift helper and its wiring are follow-up work.

## Dependencies

- `@lastfm-scrobbler/shared-types` (the `PlaybackSource` type).

## Status

Scaffolded stub only. Real-API smoke tests, once written, are gated to
`macos-latest` in CI, which also needs an Xcode toolchain to build the Swift helper.

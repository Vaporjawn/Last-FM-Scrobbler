# `packages/adapter-windows`

## Responsibility

Implements `PlaybackSource` via SMTC
(`GlobalSystemMediaTransportControlsSessionManager`, WinRT). Per ADR 0002, this talks
to SMTC through a small compiled helper binary that prints JSON events on stdout — the
same pattern as `adapter-macos` — rather than a Node native addon, to avoid
Electron-ABI prebuild pain.

## Public interface (current)

- `createWindowsPlaybackSource(): PlaybackSource` — currently throws
  "not implemented yet"; the real helper binary and its wiring are follow-up work.

## Dependencies

- `@lastfm-scrobbler/shared-types` (the `PlaybackSource` type).

## Status

Scaffolded stub only. Real-API smoke tests, once written, are gated to
`windows-latest` in CI, which also needs to build the helper binary.

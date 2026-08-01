# `packages/adapter-linux`

## Responsibility

Implements `PlaybackSource` via MPRIS2 over D-Bus (`org.mpris.MediaPlayer2.Player`).
Pure JS (`dbus-next`), no native build step — works with VLC, Rhythmbox, the Spotify
Linux client, foobar2000-under-Wine, and anything else that registers an MPRIS player.

## Public interface (current)

- `createLinuxPlaybackSource(): PlaybackSource` — currently throws
  "not implemented yet"; real MPRIS wiring is follow-up work.

## Dependencies

- `@lastfm-scrobbler/shared-types` (the `PlaybackSource` type).
- `dbus-next` will be added once the real implementation lands.

## Status

Scaffolded stub only. Real-API smoke tests, once written, are gated to
`ubuntu-latest` in CI.

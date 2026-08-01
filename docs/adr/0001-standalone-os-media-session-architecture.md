# 0001: Standalone OS-media-session architecture, not a player plugin

## Status

Accepted

## Context

The direct inspiration, foo_scrobbler_mac, is a foobar2000 plugin built against
foobar2000's own SDK. foobar2000 has no native Linux release, so "port the plugin"
cannot deliver macOS + Windows + Linux parity.

## Decision

Build a standalone background service that reads "now playing" from each OS's native
media-session API instead of one player's SDK: MPRIS2 over D-Bus on Linux, SMTC
(`GlobalSystemMediaTransportControlsSessionManager`) on Windows, MediaRemote on macOS.

## Consequences

- Works with whatever the user already has playing (Spotify, VLC, foobar2000-under-Wine,
  browsers, etc.) with zero per-player integration work, and closes the Linux gap.
- We lose foobar2000's rich internal tag database — features tied to it (Title
  Formatting, library-path exclusion) don't have a direct equivalent and are adapted
  (see ADR 0005) rather than ported as-is.
- Multiple simultaneous playback sources becomes a real problem this architecture has to
  solve that a single-player plugin never did (see ADR 0005).

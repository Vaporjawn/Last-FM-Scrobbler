# 0011: Network status detection

## Status

Accepted

## Context

Offline mode (see docs/adr/0006-offline-queue-persistence.md for the queue itself)
needed a way to know "are we online right now" — nothing in the app tracked this
proactively before; it only found out reactively, when a request happened to fail.

## Decision

Classify real traffic instead of polling. Every place the app already calls Last.fm/
Libre.fm/ListenBrainz (the scrobble-drain loop, and the Last.fm data/track-action/auth
IPC handlers) reports its outcome to one shared `NetworkStatusMonitor`
(`packages/core/src/network/`). A classifier (`isNetworkError`) distinguishes a
genuine connectivity failure (DNS/connection/timeout) from an application-level one (a
bad session, a rate limit, "artist not found") — only the former flips the monitor's
`online` flag.

Two alternatives were considered and rejected:

- Forwarding the renderer's `navigator.onLine` to the main process. This needs a
  brand-new renderer→main IPC channel (every existing main↔renderer push in this app
  goes main→renderer only), and is a weaker signal in practice — it reflects "a
  network interface is up," not "we can reach Last.fm" (true on a WiFi-connected-but-
  captive-portal machine, or when Last.fm itself is down but the network is fine).
- A dedicated periodic reachability ping. Extra network chatter and a second timer for
  a signal real traffic already provides for free in the common case.

`online`/`pendingCount` are three distinct states, not two: `online: null` means "no
connected service to test against" (no account signed in) — not "offline". The status
chip stays hidden in that case rather than falsely claiming a connectivity problem.

## Consequences

- If the app sits idle in the tray with an empty queue and no window open, the
  indicator reflects the last real attempt rather than the literal current instant —
  accepted tradeoff, since there's no user-visible activity happening in that state to
  seamlessly serve anyway, and the next real request corrects it immediately.
- Adding a new network call site in `apps/desktop`'s main process that talks to
  Last.fm/Libre.fm/ListenBrainz should wrap it in `reportNetworkOutcome` (or otherwise
  report to the shared `NetworkStatusMonitor`) to stay covered by this signal.

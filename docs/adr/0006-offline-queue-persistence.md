# 0006: Offline queue persistence

## Status

Accepted

## Context

foo_scrobbler_mac caches scrobbles locally when Last.fm or the network is unavailable,
and drains the queue later. That needs a concrete storage engine and explicit bounds —
an offline machine for months shouldn't grow the queue forever, and Last.fm rejects
scrobbles with timestamps too far in the past (or in the future, from clock skew)
regardless of how long they've been queued.

## Decision

`better-sqlite3` (synchronous, mature, well-suited to an Electron main process) rather
than a hand-rolled flat file. Scrobbles older than 14 days are dropped with a logged
warning. A max row count with oldest-first eviction bounds worst-case disk growth. A
scrobble rejected by Last.fm for a bad/future timestamp is treated as non-retryable,
logged, and dropped — not requeued.

## Consequences

- `packages/core`'s `queue` module takes a hard dependency on `better-sqlite3` once
  implemented (not yet added as a dependency in the initial scaffold — no code uses it
  yet).
- The 14-day / max-row bounds are defaults, not hardcoded constants — they should be
  easy to override once `queue` is actually built.

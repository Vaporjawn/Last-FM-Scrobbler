# `packages/core`

## Responsibility

Pure TypeScript scrobbling engine — zero OS dependencies (except `@lastfm-scrobbler/shared-types`,
its own sibling package). Owns scrobble eligibility rules, the offline queue, the
Last.fm API client, auth/session management, exclusion filters, playback tracking, and
structured logging.

## Public interface

- **`rules`** — `isEligibleForScrobble(input: EligibilityInput): boolean`. ≥50% played
  or ≥240s (whichever first), minimum 30s track length. Falls back to the 240s cap alone
  when `durationSec` is omitted (a stream with no fixed length).
- **`queue`** — `ScrobbleQueue`: SQLite-backed (`better-sqlite3`) offline cache.
  `enqueue`/`dequeueBatch`/`remove`/`recordFailure` (retryable vs. drop-outright)/
  `evictStale`/`evictOverflow`. See `docs/adr/0006-offline-queue-persistence.md`.
- **`lastfm-api`** — `LastfmClient`: every endpoint the app needs (auth, scrobble,
  now-playing, love/unlove/addTags, recent tracks, top artists, friends, artist
  info/similar). `signRequest` (pure signature function) and `LastfmApiError` +
  `isRetryableApiErrorCode`/`isRetryableScrobbleIgnoreCode` are separately exported and
  independently tested.
- **`auth`** — `AuthFlow` (token → open browser → poll `auth.getSession` until
  approved, no manual steps) and `AccountStore` (multi-account persistence over an
  injected `SecretStorage`, since core has no keychain access itself).
- **`filters`** — `compileFilter(expression): CompiledFilter`, the field-based
  exclusion DSL from `docs/adr/0005-multi-source-and-track-identity-policy.md`.
- **`tracker`** — `Tracker`: wires a `PlaybackSource`'s raw events into scrobble
  eligibility, deduping via `computeTrackIdentity` and accumulating actual elapsed
  playing time (not raw position, so seeking can't fake eligibility). Driven by an
  explicit `tick()` call from the host rather than owning a timer itself.
- **`logging`** — `Logger`: bounded ring buffer, level filtering (none/basic/debug),
  injectable sink, `formatRecentEntriesAsText()` for the bug-report relay's diagnostics.

## Dependencies

`@lastfm-scrobbler/shared-types` (`TrackInfo`, `PlaybackSource`, `PlaybackState`),
`better-sqlite3`.

## Known limitation: the Last.fm API secret ships inside the client

Last.fm's auth scheme signs every request (including scrobble calls) with an API key
**and secret**. Unlike the GitHub bug-report relay, there's no way to keep this
server-side without routing every scrobble through our own infrastructure — which would
add a hard external dependency, latency, and a new privacy surface for listening data,
which is worse than the alternative. Embedding the secret in the distributed client is
the accepted, standard approach across the open-source Last.fm scrobbler ecosystem.

## Status

Fully implemented and tested (112 tests, TDD throughout). Real Last.fm credentials
aren't available in the development/CI environment this was built in, so `lastfm-api`
and `auth` are tested entirely against mocked HTTP, not live-fired against the real API
— genuinely complete code, not yet verified against the live service.

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
  now-playing, love/unlove/addTags, recent tracks, top artists, friends, user profile,
  artist info/similar). `signRequest` (pure signature function) and `LastfmApiError` +
  `isRetryableApiErrorCode`/`isRetryableScrobbleIgnoreCode` are separately exported and
  independently tested. See "Known limitation: artist images" below before wiring
  anything that expects a real per-artist photo out of this client.
- **`auth`** — `AuthFlow` (token → open browser → poll `auth.getSession` until
  approved, no manual steps), `AccountStore` (multi-account persistence over an
  injected `SecretStorage`, since core has no keychain access itself), and
  `AppCredentialsStore` (persists a single user-supplied Last.fm API key/secret pair
  over the same `SecretStorage` abstraction — the "bring your own key" alternative to
  an app build with `LASTFM_API_KEY`/`LASTFM_API_SECRET` baked in; see
  `docs/modules/desktop.md`). Deliberately a separate class from `AccountStore`: it
  holds an *application*-level credential, not a per-user session key.
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

## Known limitation: artist images are a Last.fm-side placeholder, not real photos

`ArtistInfo` (from `getArtistInfo`) and `TopArtist` (from `getTopArtists`) deliberately
have no `imageUrl` field. Verified live against the real API (not assumed): both
`artist.getInfo` and `user.getTopArtists` return an `image` array, but every size's
`#text` points to the *exact same* generic placeholder graphic (hash
`2a96cbd8b46e442fc41c2b86b821562f`) for every artist, regardless of which one was
requested — a known, long-standing issue on Last.fm's own side (their API support
forum has multiple open threads about it going back years), not something fixable from
this client. Surfacing that URL would look like a real photo per artist when it's
actually identical for all of them — worse than not showing one at all. This is
unrelated to `UserProfile.avatarUrl` (from `getUserInfo`) or `Friend.avatarUrl` (from
`getFriends`), both of which *are* real, per-account photos — verified the same way,
against real accounts, returning genuine images rather than a placeholder.
`getFriends` needs no separate per-friend lookup for this: `user.getFriends`' response
already includes each friend's own `image` array directly, same as `user.getInfo`.

## Status

Fully implemented and tested (123 tests, TDD throughout). `lastfm-api` and `auth` were
originally tested entirely against mocked HTTP, with no real Last.fm credentials
available in the environment this was built in. That's since changed: this repo now
has a real `LASTFM_API_KEY`/`LASTFM_API_SECRET` pair (see `docs/modules/desktop.md`),
and several read endpoints (`user.getInfo`, `user.getTopArtists`) have been live-fired
against the real API directly (via `curl`) to verify actual response shapes — that's
how the artist-image limitation above was confirmed, rather than assumed from memory.
Signed/write endpoints (scrobble, love/unlove, auth session exchange) are still
untested against the live service in this environment.

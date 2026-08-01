# `packages/core`

## Responsibility

Pure TypeScript scrobbling engine — zero OS dependencies. Owns scrobble eligibility
rules, the offline queue, the Last.fm API client, auth/session management, exclusion
filters, and structured logging. See `packages/shared-types` for the `PlaybackSource`
interface adapters implement and this package consumes.

## Public interface (current)

- `isEligibleForScrobble(input: EligibilityInput): boolean` — scrobble eligibility rule
  (≥50% played or ≥240s, minimum 30s track length).

## Dependencies

None yet. Will depend on `@lastfm-scrobbler/shared-types` once the `tracker` module
(consuming `PlaybackSource`/`TrackInfo`) is implemented.

## Last.fm API surface `lastfm-api` will need to cover

`auth.getToken`, `auth.getSession`, `track.scrobble` (single + batch),
`track.updateNowPlaying`, `track.love`, `track.unlove`, `track.addTags`,
`user.getRecentTracks`, `user.getTopArtists`, `user.getFriends`, `artist.getInfo`,
`artist.getSimilar`.

## Known limitation: the Last.fm API secret ships inside the client

Last.fm's auth scheme signs every request (including scrobble calls) with an API key
**and secret**. Unlike the GitHub bug-report relay, there's no way to keep this
server-side without routing every scrobble through our own infrastructure — which would
add a hard external dependency, latency, and a new privacy surface for listening data,
which is worse than the alternative. Embedding the secret in the distributed client is
the accepted, standard approach across the open-source Last.fm scrobbler ecosystem.

## Status

Scaffolded with one real module (`rules/is-eligible-for-scrobble`), TDD, fully tested.
`queue`, `lastfm-api`, `auth`, `filters`, `tracker`, and `logging` are not yet
implemented — see ADR 0005 and ADR 0006 for the decisions already locked in for them.

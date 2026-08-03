# `packages/core`

## Responsibility

Pure TypeScript scrobbling engine — zero OS dependencies (except
`@lastfm-scrobbler/shared-types`, its own sibling package, and `better-sqlite3` for the
offline queue). Owns scrobble eligibility rules, the offline queue, multi-service
scrobbling clients (Last.fm, Libre.fm, ListenBrainz), auth/session management,
exclusion filters, playback tracking, artist-photo lookup, and structured logging.
`apps/desktop`'s main process imports this package directly — no IPC boundary, no
serialization (see `docs/adr/0002-typescript-engine.md` and
`docs/adr/0003-electron-mui-desktop-shell.md`).

## Module layout

### `rules/` — scrobble eligibility

- `is-eligible-for-scrobble.ts` — `isEligibleForScrobble(input): boolean`. A track
  qualifies once played for ≥50% of its duration or ≥240s
  (`MAX_ELIGIBILITY_THRESHOLD_SEC`), whichever is reached first, and only if the track
  itself is ≥30s long. Matches Last.fm's own scrobbling rules and the reference
  client's (`foo_scrobbler_mac`) identical rule. When `durationSec` is omitted (a
  stream with no fixed length), the 50%-of-duration half of the rule doesn't apply —
  eligibility falls back to the 240s cap alone.
- `is-likely-non-music-video.ts` — `isLikelyNonMusicVideo(input, options?): boolean`.
  Best-effort heuristic, **not** a real classifier: a regular YouTube video and a
  YouTube Music track expose structurally identical `navigator.mediaSession.metadata`
  (verified live via Playwright against real pages — both set `album` to an empty
  string, disproving the original "album present ⇒ music" assumption), so no field any
  adapter receives can reliably tell them apart. Duration is the one available signal
  that does correlate with the real complaint (long YouTube videos becoming
  scrobble-eligible after just 4 minutes, since `isEligibleForScrobble`'s 240s cap
  doesn't care how much longer the video actually runs) — flags a track as "likely not
  music" only when it both runs ≥`thresholdSec` (default
  `DEFAULT_NON_MUSIC_VIDEO_THRESHOLD_SEC` = 900s / 15 minutes, overridable via
  `AppSettings.nonMusicVideoThresholdSec`) **and** its `sourceApp` contains a known
  browser token (`chrome`, `chromium`, `safari`, `firefox`, `edge`, `brave`, `opera`,
  `vivaldi` — substring match, since `sourceApp`'s exact shape differs per
  platform/adapter). A long track from a dedicated music app (a DJ mix, a classical
  movement) is deliberately never flagged — only browser sources hit this heuristic at
  all.

### `filters/` — the exclusion-expression DSL

Implements the field-based filter language from
`docs/adr/0005-multi-source-and-track-identity-policy.md` (Settings → Filter), as a
small hand-written recursive-descent parser — not a parser-generator or regex hack.
Grammar: `field op value`, combined with `and` / `or` / `not` and parentheses. String
fields (`artist`, `title`, `album`, `albumArtist`, `sourceApp`) support `==`, `!=`,
`contains "text"`, and `matches /regex/flags`; the numeric field `durationSec` supports
`==`, `!=`, `<`, `>`, `<=`, `>=`. Example: `sourceApp == "firefox" or title matches
/^Ad: /`.

- `tokenizer.ts` — `tokenize(input): Token[]`. Hand-written lexer producing identifiers,
  string/regex/number literals, operators, and parens, terminated by an `eof` token.
  `readDelimited` supports `\"`/`\/`/`\\` escapes so a string or regex literal can
  contain its own delimiter (e.g. `/^https:\/\//`); any other backslash sequence
  (`\d`, `\s`) is left untouched for `new RegExp()` to interpret later. Rejects a
  number literal with more than one `.` (e.g. `"1.2.3"`) — without this check, such a
  literal tokenized successfully and `Number()` on it silently produced `NaN`
  downstream, and `NaN !== x` / `NaN == x` are always `true`/`false` regardless of the
  field's real value, so a typo'd numeric literal silently matched or excluded *every*
  track instead of raising a syntax error the user could notice and fix.
- `parser.ts` — `parse(expression): AstNode`. A `Parser` class implementing standard
  precedence (`or` binds loosest, then `and`, then `not`, then a parenthesized/leaf
  comparison), producing a tree of `ComparisonNode | AndNode | OrNode | NotNode`.
  Validates the field name (`isKnownField`) and that the parsed operator is legal for
  that field's type (`NUMERIC_OPERATORS`/`STRING_OPERATORS`) at parse time, not
  evaluation time — a filter with an unknown field or type-mismatched operator throws
  `FilterSyntaxError` immediately when saved, not silently no-ops later.
- `evaluate.ts` — `evaluate(node, track): boolean`. Recursively walks the AST,
  short-circuiting `and`/`or` the normal JS way and delegating leaf comparisons to
  `evaluateNumeric`/`evaluateString`, which dispatch on `NUMERIC_FIELD_ACCESSORS`/
  `STRING_FIELD_ACCESSORS`.
- `filterable-track.ts` — `FilterableTrack`: the minimal shape (`artist`, `title`,
  `album?`, `albumArtist?`, `durationSec?`, `sourceApp`) filters evaluate against —
  structurally compatible with `TrackInfo` but declared independently so this module
  doesn't need to import `@lastfm-scrobbler/shared-types` just for one interface.
- `string-field-accessors.ts` / `numeric-field-accessors.ts` — `Record<string, (track)
  => value>` maps from field name to accessor function; the single source of truth for
  "what fields exist and how to read them". `album`/`albumArtist` fall back to `""`
  (not `undefined`) so `album == ""` can match tracks with no album metadata without
  every string comparison needing its own optional-field special case.
  `durationSec`'s numeric accessor returns `undefined` (not a sentinel like `0`) when
  unknown, so a comparison against it is treated as "unknown" (`evaluateNumeric`
  returns `false`) rather than silently comparing against a fabricated number.
- `is-known-field.ts` / `is-numeric-field.ts` / `is-string-field.ts` — thin predicates
  over the two accessor maps above, used by the parser for validation.
- `filter-syntax-error.ts` — `FilterSyntaxError`, thrown by the tokenizer/parser for
  any malformed expression, unknown field, or type-mismatched operator.
- `filter-expression.ts` — the public entry point: `compileFilter(expression):
  CompiledFilter`, composing `parse` + `evaluate` into a reusable "parse once,
  evaluate many times as tracks change" matcher (`{ test(track): boolean }`). Also
  re-exports `FilterableTrack` and `FilterSyntaxError` so consumers only need to import
  from this one file.
- `combine-filters.ts` — `combineFilters(filters): CompiledFilter`. Combines several
  compiled filters with **OR** semantics: a track is excluded if it matches *any* of
  them — deliberate, since "exclude" composability means each filter is an independent
  reason to drop a track (AND semantics would make each additional exclusion rule
  exclude *less*, backwards from what turning on more exclusion rules should do). Used
  by `apps/desktop/src/main/index.ts`'s `compileFilterExpression` to merge the user's
  Settings → Filter expression with the built-in `isLikelyNonMusicVideo` heuristic into
  one filter `Tracker` checks. Returns a filter matching nothing when `filters` is
  empty.

### `tracker/` — wiring a `PlaybackSource` into scrobble eligibility

- `track-identity.ts` — `computeTrackIdentity(track, startedAtSec): string`. A stable
  identity string (`normalizedArtist::normalizedTitle::normalizedAlbum::startBucket`)
  for "this specific play of this track" — normalized (case-folded, trimmed)
  artist/title/album, bucketed into 5-second (`START_TIME_BUCKET_SEC`) windows by start
  time. Two reports of the same track starting within 5s of each other are treated as
  the same play (guards against a flaky adapter re-firing "track changed" for a play
  already in progress); starting further apart is a distinct, later listen.
- `tracker.ts` — `Tracker`, the class that ties everything together. Subscribes to a
  `PlaybackSource`'s `onTrackChanged`/`onPlaybackStateChanged`, tracks actual
  *accumulated playing time* (not raw player position — so seeking forward/backward
  can't fake or deny eligibility), applies an optional `CompiledFilter` (a filtered
  track never fires `onTrackChanged` or accumulates play time at all), dedupes via
  `computeTrackIdentity`, and fires `onScrobbleEligible` exactly once per identity once
  `isEligibleForScrobble` returns true. Deliberately owns **no timer of its own** — the
  host calls `tick()` periodically (`apps/desktop`'s main process does this every
  second); this keeps the whole state machine a deterministic function of explicit
  calls rather than wall-clock side effects, which is what makes it fully testable
  without fake timers. A redundant "playing" event fired while already playing still
  triggers `accumulate()` (rather than being ignored) specifically so it can never
  silently discard already-elapsed time by resetting the accumulation point without
  first adding it to `playedSec` — nothing in the `PlaybackSource` contract guarantees
  an adapter only emits a state change on a genuine transition.

### `queue/` — offline scrobble persistence

- `scrobble-queue.ts` — `ScrobbleQueue`, a `better-sqlite3`-backed durable queue
  implementing `docs/adr/0006-offline-queue-persistence.md`. One table
  (`pending_scrobbles`), WAL journal mode, an index on `timestamp`. Public surface:
  `enqueue(scrobble)` (returns the row with its assigned `id`), `dequeueBatch(limit)`
  (oldest-first), `remove(ids)`, `recordFailure(id, {retryable, reason})` (increments
  `retry_count`/`last_error` if retryable, otherwise deletes the row outright —
  matching ADR 0006's "a scrobble rejected for a bad/future timestamp is non-retryable,
  logged, and dropped" policy), `evictStale(now?)` (drops rows older than
  `maxAgeDays`, default 14), `evictOverflow()` (drops the oldest rows beyond `maxRows`,
  default 1000), `count()`, and `close()`. `databasePath: ":memory:"` gives an
  ephemeral in-process queue, used throughout this package's own tests.

### `lastfm-api/` — the Last.fm/Audioscrobbler REST client

- `client.ts` — `LastfmClient`, a thin wrapper over every endpoint the app needs: auth
  (`getAuthToken`, `buildAuthUrl`, `getSession`), writes (`updateNowPlaying`,
  `scrobble`, `love`, `unlove`, `addTags`), and reads (`getRecentTracks`,
  `getTopArtists`, `getTopTracks`, `getTopAlbums`, `getFriends`, `getUserInfo`,
  `getLovedTracksCount`, `getArtistInfo`, `getArtistImageUrl`, `getSimilarArtists`,
  `getTopTags`, `getTrackInfo`). Every write is signed per `signRequest`; every
  response is checked via a structural `isErrorPayload` guard and thrown as a
  `LastfmApiError` on failure. `scrobble([])` short-circuits to an empty accepted
  result rather than hitting the network — Last.fm's own response shape for a
  zero-item batch omits the `scrobble` field entirely, which would otherwise throw a
  raw `TypeError` out of the response-mapping code. Batches over
  `MAX_SCROBBLE_BATCH_SIZE` (50, Last.fm's own documented limit) throw synchronously
  before any request is made. **Also the concrete client Libre.fm reuses** — Libre.fm
  is protocol-identical to Last.fm, so `LastfmClientOptions.baseUrl`/`authUrl` simply
  point the same class at a different host (see `apps/desktop/src/main/auth/
  wire-secondary-auth.ts`); nothing in this file assumes "Last.fm" beyond the two
  default URL constants.
- `types.ts` — every request/response shape this client exposes
  (`ScrobbleSubmission`, `NowPlayingSubmission`, `LastfmSession`, `ScrobbleResultItem`,
  `ScrobbleBatchResult`, `TrackRef`, `RecentTrack`, `TopArtist`/`TopTrack`/`TopAlbum`
  plus their `*Period` enums, `UserProfile`, `Friend`, `ArtistInfo`, `SimilarArtist`,
  `TrackDetail`). Several fields carry extensive live-verification docstrings — see
  "Known limitation: artist images" below for the most important one.
- `sign-request.ts` — `signRequest(params, secret): string`. Implements Last.fm's
  `api_sig` algorithm exactly per https://www.last.fm/api/authspec: sort every
  parameter except `format`/`callback` alphabetically, concatenate as `name+value`
  pairs, append the shared secret, MD5-hash.
- `lastfm-error.ts` — `LastfmApiError`, carrying the numeric Last.fm error `code`
  alongside the message.
- `is-retryable-api-error-code.ts` — whether a *general* API error code (8 backend
  hiccup, 11 service offline, 16 temporary error, 29 rate limit exceeded) represents a
  transient condition worth retrying, versus a permanent one (bad request, bad
  credentials, suspended key) that will fail identically every time.
- `is-retryable-scrobble-ignore-code.ts` — whether a *per-scrobble* `ignoredMessage`
  code from an otherwise-successful `track.scrobble` call is retryable. Only code 5
  ("daily scrobble limit exceeded") is — codes 1/2 (artist/track ignored) are
  content-based and resubmitting changes nothing, and codes 3/4 (timestamp too
  old/new) are malformed-scrobble cases matching ADR 0006's non-retryable clock-skew
  policy.

### `listenbrainz-api/` — the ListenBrainz client

Not mentioned in earlier drafts of this document — a full second scrobbling backend,
alongside Last.fm/Libre.fm.

- `client.ts` — `ListenBrainzClient`, implementing the shared `ScrobblingClient`
  interface (see below) against ListenBrainz's `submit-listens` API
  (https://listenbrainz.readthedocs.io/en/latest/users/api/core.html). Auth is a
  single static per-account API token pasted in by the user (`Authorization: Token
  <token>` header) — there is no browser-authorization flow the way Last.fm/Libre.fm
  have (`AuthFlow` doesn't apply here); `validateToken(token)` calls `GET
  /1/validate-token` to resolve and confirm a candidate token before committing to it,
  checking the response's `valid` field rather than HTTP status — verified live that a
  genuinely invalid token comes back as HTTP 200 wrapping `{"valid": false}`, not a
  4xx. `updateNowPlaying` posts `listen_type: "playing_now"`; `scrobble` posts
  `listen_type: "single"` with one `payload` entry per submission — verified live that
  batched submission of multiple listens per request is supported for regular use
  (`MAX_LISTENS_PER_REQUEST` = 1000, ListenBrainz's own documented limit, well above
  what this app ever sends at once). Unlike Last.fm's `track.scrobble`, ListenBrainz's
  response carries no per-listen accept/ignore detail — a 2xx means the whole batch was
  accepted, so every submission maps to an `accepted` result; a partial or whole-batch
  rejection surfaces as a thrown `ListenBrainzApiError` instead. `scrobble([])`
  short-circuits the same way `LastfmClient.scrobble([])` does.
- `listenbrainz-error.ts` — `ListenBrainzApiError`, carrying the HTTP status as `code`
  (the one reliable signal — ListenBrainz's error-body shape isn't fully verified;
  `message` is parsed best-effort from whichever of `error`/`message` the body
  happens to have).

### `scrobbling-client.ts` — the multi-service abstraction

`ScrobblingClient`: a minimal, service-agnostic interface (`updateNowPlaying`,
`scrobble`) that `apps/desktop/src/main/scrobbling/wire-scrobbling.ts` submits
scrobbles through without caring which service is on the other end. `LastfmClient`
satisfies it structurally (used as-is for Last.fm and Libre.fm); `ListenBrainzClient`
implements it directly. Deliberately a standalone interface rather than an
indexed-access type off `LastfmClient` (this project's original, pre-multi-service
shape) — that tied every scrobbling-capable client to `LastfmClient`'s own method
signatures even though nothing about "submit these scrobbles" is Last.fm-specific.

### `auth/` — session and credential storage

- `secret-storage.ts` — `SecretStorage`: the minimal key-value interface
  (`get`/`set`/`delete`/`list`) `AccountStore`/`AppCredentialsStore` persist through.
  Deliberately abstract, since `packages/core` has zero OS dependencies — the desktop
  app supplies a real implementation backed by Electron's `safeStorage` (OS keychain;
  see `docs/modules/desktop.md` for the Linux-keyring caveat this interface itself
  can't see or handle).
- `account-store.ts` — `AccountStore`, persisting Last.fm-protocol accounts (one
  `StoredAccount { username, sessionKey }` each) and tracking which is "active" — the
  multi-account switching in Preferences → Accounts. `AccountStoreOptions.namespace`
  (default `""`, fully backward compatible) prefixes every key this instance writes,
  letting a Last.fm-account instance and a Libre.fm-account instance share one
  underlying `SecretStorage` without their keys colliding.
- `app-credentials-store.ts` — `AppCredentialsStore`, persisting a user-supplied
  `AppCredentials { apiKey, apiSecret }` pair for an Audioscrobbler-protocol service —
  the "bring your own key" alternative to a build with credentials baked in via
  environment variables (see `docs/modules/desktop.md`). Namespaced the same way as
  `AccountStore`. Deliberately a separate class/store from `AccountStore`: this holds
  an *application*-level credential, not a per-user session key.
- `auth-flow.ts` — `AuthFlow`, driving Last.fm's desktop auth flow end to end with no
  manual token entry: `getAuthToken()` → open the browser to `buildAuthUrl(token)` →
  silently poll `getSession(token)` until it stops returning error code 14 ("token not
  authorized yet") or the configured `timeoutMs` (default 5 minutes, polling every
  `pollIntervalMs` = 3s by default) elapses, at which point it throws
  `AuthTimeoutError`. Takes an `AuthFlowClient` (the narrow `getAuthToken`/
  `buildAuthUrl`/`getSession` subset of `LastfmClient` it actually needs, for easy
  test doubling) plus injectable `openUrl`/`sleepImpl`/`now` for full determinism in
  tests.
- `auth-timeout-error.ts` — `AuthTimeoutError`, thrown when the user never clicks
  "Allow Access" within the poll window.

### `logging/`

- `logger.ts` — `Logger`, a structured logger with a bounded in-memory ring buffer
  (`maxEntries`, default 500) feeding both live debugging and the bug-report feature's
  "recent log lines" diagnostics attachment (see
  `docs/adr/0004-anonymous-bug-report-relay.md`). Three-level filtering (`"none"` /
  `"basic"` / `"debug"`, default `"basic"` — `"basic"` logs everything except `debug`
  severity), an injectable `sink` callback for e.g. writing to a file, and
  `formatRecentEntriesAsText(limit?)` for a plain-text rendering suitable for
  attaching to a report. Callers are responsible for never logging secrets (session
  keys, API secrets) — the logger has no way to know what's sensitive; see
  `docs/modules/desktop.md`'s code-review non-findings for confirmation no call site
  in the desktop app actually does.

### `artist-images/`

- `fetch-artist-image-url.ts` — `fetchArtistImageUrl(artistName, fetchImpl?):
  Promise<string | undefined>`. Real per-artist photos sourced from **Deezer's**
  public, unauthenticated `search/artist` endpoint — not Last.fm, whose own artist
  images are a shared placeholder (see "Known limitation" below). Fetches the top 5
  (`SEARCH_RESULT_LIMIT`) search results rather than just the first — verified live
  that some well-known artists (e.g. "Kendrick Lamar") have a near-empty duplicate
  catalog entry with no real photo that Deezer's own relevance ranking puts *ahead* of
  the real, well-followed entry. Prefers an exact (case-insensitive) name match that
  actually has a photo, falling back to the first candidate with any real photo at all
  (covers stylization/tribute-act mismatches). Filters out Deezer's own "no photo"
  placeholder (`DEEZER_NO_PHOTO_HASH` — the MD5 hash of an empty string, Deezer's own
  sentinel, not a coincidence) the same way the Last.fm client filters its own
  placeholder. Best-effort by design: no match, a request failure, or a placeholder
  result all resolve to `undefined` rather than throwing — a missing decorative photo
  should never be able to break a page. See
  `apps/desktop/src/main/artist-images/wire-artist-image.ts` for how the desktop app
  actually sequences this against Last.fm's own (placeholder) artist data.

## Public interface

Everything above is re-exported from `src/index.ts` (`@lastfm-scrobbler/core`'s
package entry point) — see that file directly for the exact export list, which mirrors
the module breakdown above one-to-one (types via `export type`, values via `export`).

## Dependencies

`@lastfm-scrobbler/shared-types` (`TrackInfo`, `PlaybackSource`, `PlaybackState`,
`Unsubscribe`), `better-sqlite3` (native, synchronous SQLite — chosen over a hand-rolled
flat file specifically for `queue/scrobble-queue.ts`; see
`docs/adr/0006-offline-queue-persistence.md`). No dependency on any adapter package —
`core` only ever sees the `PlaybackSource` interface.

## Known limitation: the Last.fm API secret ships inside the client

Last.fm's auth scheme signs every request (including scrobble calls) with an API key
**and secret**. Unlike the GitHub bug-report relay, there's no way to keep this
server-side without routing every scrobble through our own infrastructure — which would
add a hard external dependency, latency, and a new privacy surface for listening data,
which is worse than the alternative. Embedding the secret in the distributed client is
the accepted, standard approach across the open-source Last.fm scrobbler ecosystem.

## Known limitation: artist images are a Last.fm-side placeholder, not real photos

`ArtistInfo` (from `getArtistInfo`), `TopArtist` (from `getTopArtists`), and
`SimilarArtist` deliberately have no `imageUrl` field. Verified live against the real
API (not assumed): `artist.getInfo`, `user.getTopArtists`, and `user.getTopTracks` all
return an `image` array, but every size's `#text` points to the *exact same* generic
placeholder graphic (hash `2a96cbd8b46e442fc41c2b86b821562f`) for every artist/track,
regardless of which one was requested — a known, long-standing issue on Last.fm's own
side (their API support forum has multiple open threads about it going back years),
not something fixable from this client. Surfacing that URL would look like a real
photo per artist when it's actually identical for all of them — worse than not showing
one at all. This is unrelated to `UserProfile.avatarUrl` (from `getUserInfo`),
`Friend.avatarUrl` (from `getFriends`), or `TopAlbum.imageUrl`/`RecentTrack.imageUrl`/
`TrackDetail.imageUrl` (real album/track cover art), all of which *are* real, verified
live the same way against real accounts/data.

**Real per-artist photos are still available** — just not from Last.fm.
`artist-images/fetch-artist-image-url.ts` sources them from Deezer's public artist
search instead (see above); `apps/desktop/src/main/artist-images/wire-artist-image.ts`
is what actually chains "Last.fm for bio/stats" + "Deezer for a real photo" together
for the renderer.

## Status

Fully implemented and tested (see `docs/TESTING.md` for exact per-package counts —
this package's suite spans `rules/`, `filters/`, `tracker/`, `queue/`, `lastfm-api/`,
`listenbrainz-api/`, `auth/`, `logging/`, and `artist-images/`, TDD throughout).
`lastfm-api` and `auth` were originally tested entirely against mocked HTTP, with no
real Last.fm credentials available in the environment this was built in. That's since
changed: this repo now has a real `LASTFM_API_KEY`/`LASTFM_API_SECRET` pair (see
`docs/modules/desktop.md`), and several read endpoints (`user.getInfo`,
`user.getTopArtists`, `user.getTopTracks`, `user.getTopAlbums`, `user.getFriends`,
`user.getRecentTracks`, `user.getLovedTracks`) have been live-fired against the real
API directly (via `curl`) to verify actual response shapes — that's how the
artist-image limitation above was confirmed, rather than assumed from memory. The
`listenbrainz-api` client's `submit-listens`/`validate-token` endpoints were similarly
live-verified against the real ListenBrainz API this way (see `client.ts`'s own
docstring for exactly what was and wasn't confirmed). Signed/write Last.fm endpoints
(`track.scrobble`, `track.love`/`unlove`/`addTags`, the auth session exchange) are
still untested against the live service in this environment.

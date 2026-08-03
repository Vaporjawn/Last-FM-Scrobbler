# `packages/adapter-linux`

## Responsibility

Implements `PlaybackSource` via MPRIS2 over D-Bus (`org.mpris.MediaPlayer2.Player`).
Pure JS (`dbus-next`), no native build step — works with VLC, Rhythmbox, the Spotify
Linux client, browsers with MPRIS extensions, and anything else that registers an MPRIS
player. Unlike macOS's MediaRemote, MPRIS2 is a documented, public, unrestricted D-Bus
interface — no private-API workarounds needed.

## Public interface (current)

- `createLinuxPlaybackSource(options?): PlaybackSource` — connects to the D-Bus session
  bus lazily on first subscription (disconnecting once every subscriber unsubscribes),
  discovers running MPRIS players, and tracks them all simultaneously.
  `options.sessionBus`/`options.now` are injectable for testing;
  `options.onError` receives non-fatal per-player errors (e.g. a player that vanishes
  mid-connect — normal desktop lifecycle, not treated as fatal) and D-Bus connection-
  level errors (see below).
- `PlayerRegistry` — the pure (no D-Bus dependency) multi-source arbitration state
  machine implementing docs/adr/0005-multi-source-and-track-identity-policy.md:
  whichever player is `Playing` and most recently _started_ wins; if none are playing,
  the most recently _changed_ player's state is reported.

### Module layout (`src/mpris/`)

- `mpris-dbus-names.ts` — the per-player interface constants every already-discovered
  player is talked to through: `MPRIS_PATH` (`/org/mpris/MediaPlayer2`),
  `PLAYER_IFACE` (`org.mpris.MediaPlayer2.Player`), `PROPERTIES_IFACE`
  (`org.freedesktop.DBus.Properties`).
- `mpris-discovery-dbus-names.ts` — the separate set of constants for talking to the
  D-Bus daemon *itself* to discover/watch the set of running players:
  `MPRIS_PREFIX` (`org.mpris.MediaPlayer2.` — every MPRIS player's bus name starts with
  this), `DBUS_SERVICE`/`DBUS_PATH` (`org.freedesktop.DBus` / `/org/freedesktop/DBus`).
  Split from `mpris-dbus-names.ts` because these two constant groups are used by
  entirely different call sites for entirely different purposes (discovering players
  vs. talking to one already-found player), even though both are "MPRIS D-Bus names".
- `call-dbus-method.ts` — `callDBusMethod(iface, methodName, ...args)`. Small shared
  helper working around `noUncheckedIndexedAccess` making `dbus-next`'s
  `ClientInterface` index-signature method calls (`iface[methodName]`) look possibly
  `undefined` to TypeScript; centralizes the one defensive check that requires into a
  single place with a clear thrown error if a remote object doesn't actually implement
  a method its own introspection data promised.
- `unwrap-variant.ts` — `unwrapVariant(value)`. Unwraps a `dbus-next` `Variant`
  wrapper object (`{ value: ... }`) if present, passing plain values through
  unchanged — D-Bus's `a{sv}` (dict of Variant) types show up throughout MPRIS
  properties, and not every value arrives wrapped the same way in practice.
- `map-metadata-to-track-info.ts` — `mapMetadataToTrackInfo(metadata, sourceApp):
  TrackInfo | null`. Maps an MPRIS `Metadata` property (an `a{sv}` dict) to
  `TrackInfo`, returning `null` when `xesam:title` — the one field treated as
  mandatory — is missing or empty. Tolerates nonconformant players: `xesam:artist`/
  `xesam:albumArtist` are spec'd as string arrays but some real players send a plain
  string instead (`readStringOrStringList` accepts either, joining arrays with `", "`
  to match how Last.fm scrobbles multi-artist tracks); `mpris:length` (microseconds,
  spec'd as a signed 64-bit int) commonly arrives as a `bigint` but sometimes as a
  plain `number` — both handled, non-positive values treated as "no duration".
  `isStream` is always `false` — MPRIS has no dedicated stream/radio field, and
  deriving it from "no `mpris:length` reported" used to misclassify any track from a
  non-conformant player (common; many minimal MPRIS clients simply don't populate it)
  as a stream, even though the identical content was correctly `isStream: false` on
  macOS at the same moment (mirrors the identical fix in `adapter-windows`'s payload
  mapper).
- `map-playback-status.ts` — `mapPlaybackStatus(status): PlaybackState`. Only
  MPRIS's spec-defined `"Playing"`/`"Paused"` map to their obvious counterparts;
  anything else (missing, empty, or a nonconformant value seen in the wild) maps to
  `"stopped"` rather than guessing.
- `derive-source-app-from-bus-name.ts` — `deriveSourceAppFromBusName(busName):
  string`. Strips the `org.mpris.MediaPlayer2.` prefix and any `.instanceN`
  multi-instance suffix a player MAY append per the MPRIS spec (e.g.
  `"org.mpris.MediaPlayer2.firefox.instance1_2"` → `"firefox"`), producing a stable
  `sourceApp` value suitable for the filter DSL's `sourceApp == "firefox"` comparisons
  — an unstripped per-instance suffix would make the same browser match a different
  string every time it restarts.
- `list-mpris-player-bus-names.ts` — `listMprisPlayerBusNames(bus): Promise<string[]>`.
  Calls the D-Bus daemon's own `ListNames` and filters to the `MPRIS_PREFIX` — the
  one-shot "what's running right now" discovery call used on startup.
- `watch-mpris-player-lifecycle.ts` — `watchMprisPlayerLifecycle(bus, onChange):
  Promise<Unsubscribe>`. Subscribes to `org.freedesktop.DBus`'s `NameOwnerChanged`
  signal (fired for *every* bus name change on the whole session bus, not just MPRIS
  ones — filtered here to the `MPRIS_PREFIX`), reporting `{busName, appeared}` for
  each player starting (`newOwner !== ""`) or stopping (`oldOwner !== ""`, new owner
  empty). This is what lets the adapter react to a player launching or quitting after
  the initial `listMprisPlayerBusNames` snapshot, without polling.
- `watch-mpris-player.ts` — `watchMprisPlayer(bus, busName, onUpdate):
  Promise<Unsubscribe>`. Connects to one already-discovered player's `Player`
  interface, fetches its current `Metadata`/`PlaybackStatus` via `GetAll`, calls
  `onUpdate` once immediately with that initial state, then subscribes to further
  `PropertiesChanged` signals. Handles a real D-Bus Properties-spec subtlety not
  obvious from the interface alone: a player MAY report a changed property by listing
  its name in `PropertiesChanged`'s third ("invalidated") argument instead of inlining
  the new value in the second — typically done for expensive-to-serialize properties.
  The signal alone carries no new value in that case, so `refetchInvalidated` re-fetches
  via `GetAll` for whichever of `Metadata`/`PlaybackStatus` were invalidated (tolerating
  a fetch failure the same "player may have vanished" way the rest of this module
  does). Throws if the player can't be reached at all when first watched — the caller
  (`create-linux-playback-source.ts`) treats that as "this player is gone", not a fatal
  adapter error, since player lifecycle on a real desktop is inherently racy.
- `query-mpris-position.ts` — `queryMprisPosition(bus, busName): Promise<number>`.
  On-demand `Position` query, converted from microseconds to seconds — MPRIS explicitly
  documents `Position` as unsuitable for push notifications (a signal every ~16ms), so
  unlike `Metadata`/`PlaybackStatus` this must be actively polled. Never rejects — a
  player that's gone, unreachable, or returns something unexpected resolves to `0`
  rather than surfacing a scrobble-irrelevant transport detail as a hard error.
- `player-registry.ts` — `PlayerRegistry`, the pure (no D-Bus dependency) arbitration
  policy from ADR 0005: tracks every known player's latest `TrackInfo`/`PlaybackState`
  plus *when* it last changed and when it most recently started playing, and
  `getActive()`/`getActiveBusName()` pick the winner — whichever player is `Playing`
  and started most recently, or (if none are playing) whichever player's state most
  recently changed at all. `update()` is a no-op (doesn't touch `lastChangedAt`) when
  the incoming track/state are structurally identical to what's already recorded, so a
  duplicate `PropertiesChanged` signal can't spuriously make an already-current player
  look "more recently changed" than it really was.
- `create-linux-playback-source.ts` — composes all of the above into the public
  `PlaybackSource`. On `ensureStarted()`: attaches an error listener to the bus itself
  (`bus.on("error", ...)` — `getSessionBus()` returns synchronously but the underlying
  connection/`Hello` handshake completes asynchronously; a failure there — no session
  bus reachable, the bus restarting, a logout mid-session — is forwarded via
  `bus.emit("error", ...)` per `dbus-next`'s own implementation, and with no listener
  attached Node's default `EventEmitter` behavior for an unhandled `'error'` event is to
  *throw*, crashing the whole host process), lists and watches every currently-running
  player, then subscribes to lifecycle changes for players starting/stopping
  afterward. `emitIfChanged()` gates every `onTrackChanged`/`onPlaybackStateChanged`
  emission behind a structural `tracksEqual` compare against the last-emitted snapshot
  — the same class of dedup fix `adapter-windows`'s `create-windows-playback-source.ts`
  needed for SMTC's noisy `TimelinePropertiesChanged`, applied here so a
  `PropertiesChanged` signal touching an already-current player's already-current
  fields doesn't re-notify subscribers with nothing actually different.
  `stopIfNoSubscribers()` unsubscribes every per-player watcher, unsubscribes the
  lifecycle watcher, and disconnects the bus once nobody's listening.

## Dependencies

- `@lastfm-scrobbler/shared-types` (the `PlaybackSource` type).
- `dbus-next` (pure JS + one native helper, `usocket`, for the raw D-Bus socket —
  approved in `pnpm-workspace.yaml`'s `allowBuilds`).
- `dbus-daemon` at test time only, for the real-pipeline smoke test (see Status).

`dbus-next`'s own dependency tree is the reason the root `package.json`/
`pnpm-workspace.yaml` carry an `overrides` block at all — `npm audit --omit=dev` once
reported 10 vulnerabilities (3 critical) reachable through it. See
`docs/adr/0010-dbus-next-transitive-vulnerability-audit.md` for the full reachability
investigation and why the audit is clean now.

## Status

Fully implemented and tested: tests span the pure mappers
(`map-metadata-to-track-info`, `map-playback-status`, `derive-source-app-from-bus-name`),
`PlayerRegistry`'s arbitration policy (including simultaneous-playing and
re-resume-after-pause scenarios), position querying, and the D-Bus composition layer
(`create-linux-playback-source.test.ts`, via an injected fake bus). Additionally
live-verified against a **real** D-Bus pipeline —
`tests/mpris/mpris-adapter.smoke.test.ts` spawns its own throwaway `dbus-daemon`,
registers a real MPRIS2 service on it via `dbus-next`'s own service API (a second,
independent connection — not a mock of this project's code), and confirms
`createLinuxPlaybackSource()` correctly discovers it, reports its real initial
metadata, and reacts to live `PropertiesChanged` signals for both a track change and a
playback-state change — genuine wire-protocol coverage, not mocked-in-process. Skips
itself (rather than failing) if `dbus-daemon` isn't available; CI installs it
defensively on `ubuntu-latest` to make sure that never happens there. Not yet
live-verified against a real third-party player (VLC/Spotify) specifically — only
against this project's own real-protocol mock — since no Linux machine was available
in this development environment.

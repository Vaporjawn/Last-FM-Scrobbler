/**
 * IPC channel names shared between the main process (sender) and preload script
 * (listener, via `contextBridge`) — kept in one place so the two sides can't drift
 * apart on a typo'd string literal.
 */
export const IPC_CHANNELS = {
  nowPlayingTrackChanged: "now-playing:track-changed",
  nowPlayingStateChanged: "now-playing:state-changed",
  /** Pushed roughly every second (see wireNowPlaying's TRACKER_TICK_INTERVAL_MS)
   * while something is actively playing — elapsed playback position in seconds. Not
   * pushed while paused/stopped, since the position isn't moving; renderer state
   * resets to 0 on every track change independently (see use-now-playing.ts) rather
   * than waiting on this channel to do it. */
  nowPlayingPositionChanged: "now-playing:position-changed",
  /** Renderer -> main `invoke`: pulls the current snapshot on mount, since a
   * newly-attached listener otherwise only sees *future* push updates and would show
   * nothing until the next track/state change even if something is already playing. */
  nowPlayingGetCurrent: "now-playing:get-current",

  /** Runs the full Last.fm browser-authorization flow and stores the resulting
   * account. Resolves with the new account's username. */
  authLogin: "auth:login",
  /** Removes a stored account by username. */
  authLogout: "auth:logout",
  /** Lists stored account usernames (never session keys — those never leave main). */
  authListAccounts: "auth:list-accounts",
  /** The currently-active account's username, or undefined if none is active. */
  authGetActiveAccount: "auth:get-active-account",
  /** Switches which stored account is active. */
  authSetActiveAccount: "auth:set-active-account",
  /** Whether this build has LASTFM_API_KEY/LASTFM_API_SECRET configured at all —
   * distinct from "no account logged in yet". */
  authIsConfigured: "auth:is-configured",
  /** Where the active Last.fm API key/secret came from: "environment" (baked into
   * this build), "user-supplied" (saved via Settings), or "none". */
  authCredentialsSource: "auth:credentials-source",
  /** Saves a user-supplied Last.fm API key/secret pair (the "bring your own key"
   * alternative to a build with LASTFM_API_KEY/LASTFM_API_SECRET baked in). Takes
   * effect on next launch — call `appRelaunch` afterward to apply it. */
  authSetAppCredentials: "auth:set-app-credentials",
  /** Clears a previously-saved user-supplied API key/secret pair. */
  authClearAppCredentials: "auth:clear-app-credentials",
  /** Restarts the app so newly-saved credentials take effect. */
  appRelaunch: "app:relaunch",
  /** The running app's own version (`app.getVersion()`, from `package.json`/
   * electron-builder's packaged metadata) — shown in Settings → General. */
  appGetVersion: "app:get-version",
  /** Brings the main window to the front — the tray mini-player popover's "Open
   * Last.fm Scrobbler" button. */
  appShowMainWindow: "app:show-main-window",

  /** `user.getRecentTracks` for a given username. */
  lastfmGetRecentTracks: "lastfm:get-recent-tracks",
  /** `user.getTopArtists` for a given username. */
  lastfmGetTopArtists: "lastfm:get-top-artists",
  /** `user.getTopTracks` for a given username. */
  lastfmGetTopTracks: "lastfm:get-top-tracks",
  /** `user.getTopAlbums` for a given username. */
  lastfmGetTopAlbums: "lastfm:get-top-albums",
  /** `user.getFriends` for a given username. */
  lastfmGetFriends: "lastfm:get-friends",
  /** `user.getInfo` for a given username — real name + avatar photo. */
  lastfmGetUserInfo: "lastfm:get-user-info",
  /** `artist.getInfo` — bio summary + global listener/play stats for an artist. */
  lastfmGetArtistInfo: "lastfm:get-artist-info",
  /** `artist.getSimilar` for an artist. */
  lastfmGetSimilarArtists: "lastfm:get-similar-artists",
  /** `artist.getTopTags` for an artist. */
  lastfmGetTopTags: "lastfm:get-top-tags",
  /** `track.getInfo` for an artist+track pair. */
  lastfmGetTrackInfo: "lastfm:get-track-info",
  /** `track.love`, signed as the currently-active account. */
  lastfmLoveTrack: "lastfm:love-track",
  /** `track.unlove`, signed as the currently-active account. */
  lastfmUnloveTrack: "lastfm:unlove-track",
  /** `track.addTags`, signed as the currently-active account. */
  lastfmAddTags: "lastfm:add-tags",

  /** Whether this build has a bug-report relay URL configured. */
  bugReportIsConfigured: "bug-report:is-configured",
  /** Submits {title, body} to services/bug-report-relay; resolves with the created
   * GitHub issue's URL. */
  bugReportSubmit: "bug-report:submit",

  /** Returns the current persisted `AppSettings` (see `shared/settings-api.ts`). */
  settingsGet: "settings:get",
  /** Merges a partial `AppSettings` patch and returns the full updated settings. */
  settingsSet: "settings:set",
  /** Replaces all persisted settings with `DEFAULT_APP_SETTINGS` and returns them —
   * Settings → "Reset to defaults" uses this rather than `settingsSet` so optional
   * fields (`windowBounds`, `filterExpression`) actually clear instead of surviving a
   * merge patch. See `SettingsStore.reset()`'s docstring. */
  settingsReset: "settings:reset",

  /** Pushed whenever the auto-updater's state changes (checking/available/
   * downloading/downloaded/error) — see `shared/update-status.ts`. */
  updatesStatusChanged: "updates:status-changed",
  /** Renderer -> main `invoke`: pulls the current status on mount, same
   * push-plus-pull reasoning as `nowPlayingGetCurrent`. */
  updatesGetStatus: "updates:get-status",
  /** Triggers an update check immediately, regardless of `AppSettings.autoUpdateEnabled`. */
  updatesCheckNow: "updates:check-now",

  /** Real per-artist photo lookup via Deezer — see `shared/artist-image-api.ts` and
   * `packages/core`'s `fetchArtistImageUrl` for why this isn't a `lastfm:*` channel. */
  artistImageGetUrl: "artist-image:get-url",

  /** Validates a `packages/core` filter-DSL expression (see
   * `AppSettings.filterExpression`) without applying it — Settings → Filter uses this
   * for inline feedback before saving. Resolves `{ valid: true }` or `{ valid: false,
   * error }` (a `FilterSyntaxError`'s message), never rejects — compiling the filter
   * happens in the main process (see `shared/filter-api.ts`'s docstring for why:
   * `@lastfm-scrobbler/core`'s bundled output isn't safe to import into the renderer). */
  filterValidate: "filter:validate",
} as const;

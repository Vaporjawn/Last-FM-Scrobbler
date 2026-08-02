/**
 * IPC channel names shared between the main process (sender) and preload script
 * (listener, via `contextBridge`) — kept in one place so the two sides can't drift
 * apart on a typo'd string literal.
 */
export const IPC_CHANNELS = {
  nowPlayingTrackChanged: "now-playing:track-changed",
  nowPlayingStateChanged: "now-playing:state-changed",
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

  /** `user.getRecentTracks` for a given username. */
  lastfmGetRecentTracks: "lastfm:get-recent-tracks",
  /** `user.getTopArtists` for a given username. */
  lastfmGetTopArtists: "lastfm:get-top-artists",
  /** `user.getFriends` for a given username. */
  lastfmGetFriends: "lastfm:get-friends",
} as const;

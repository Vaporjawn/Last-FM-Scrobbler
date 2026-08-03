/**
 * The renderer-facing Libre.fm/ListenBrainz API the preload script exposes via
 * `contextBridge.exposeInMainWorld("librefm"/"listenbrainz", ...)` — the additional
 * scrobbling-destination counterparts to `AuthApi` (Last.fm). Deliberately simpler
 * than `AuthApi` in two ways: neither service supports this app's baked-in-credentials
 * path (both are always "bring your own key"/"bring your own token"), and neither
 * exposes multi-account switching — this app connects at most one account per service
 * at a time, submitting to every currently-connected service in parallel (see
 * `apps/desktop/src/main/scrobbling/wire-scrobbling.ts`) rather than switching between
 * them. Same rule as `AuthApi`: never carries a session key/token across the IPC
 * boundary, only usernames.
 */
export interface LibrefmApi {
  /** Whether a Libre.fm API key/secret pair has been saved via Settings → Accounts —
   * Libre.fm has no baked-in-credentials build variant, so this is always
   * `"user-supplied"` (or unconfigured), unlike `AuthApi.credentialsSource()`. */
  isConfigured(): Promise<boolean>;
  /** Saves a user-supplied Libre.fm API key/secret pair. Unlike
   * `AuthApi.setAppCredentials`, takes effect immediately — Libre.fm's client is
   * constructed fresh from whatever's currently saved at the moment `login()` is
   * called, not fixed at app startup, so there's no relaunch step needed. Throws if
   * secure storage isn't available on this system, or if either value is empty. */
  setCredentials(apiKey: string, apiSecret: string): Promise<void>;
  /** Clears a previously-saved Libre.fm API key/secret pair. */
  clearCredentials(): Promise<void>;
  /** Opens the user's browser to Libre.fm's authorization page and resolves once
   * they've approved access there (no manual token entry) — same flow as
   * `AuthApi.login()`, just pointed at Libre.fm. Throws if `isConfigured()` would be
   * false, or if the user doesn't approve within the timeout. */
  login(): Promise<{ username: string }>;
  /** Disconnects the currently-connected Libre.fm account, if any. */
  logout(): Promise<void>;
  getActiveAccount(): Promise<string | undefined>;
}

export interface ListenBrainzApi {
  /** Validates `token` against ListenBrainz's `/1/validate-token` and, if it's valid,
   * stores it as the connected account. Resolves with the account it belongs to.
   * Throws with a user-facing message if the token is invalid or the request fails —
   * ListenBrainz has no browser-authorization flow to drive (see
   * `packages/core`'s `ListenBrainzClient`'s docstring); the user pastes a token
   * directly from their ListenBrainz profile settings page. */
  connect(token: string): Promise<{ username: string }>;
  /** Disconnects the currently-connected ListenBrainz account, if any. */
  disconnect(): Promise<void>;
  getActiveAccount(): Promise<string | undefined>;
}

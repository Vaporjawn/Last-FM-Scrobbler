/**
 * The renderer-facing Libre.fm/ListenBrainz API the preload script exposes via
 * `contextBridge.exposeInMainWorld("librefm"/"listenbrainz", ...)` — the additional
 * scrobbling-destination counterparts to `AuthApi` (Last.fm). `LibrefmApi` mirrors
 * `AuthApi` closely, including the same baked-in-vs-user-supplied credential split
 * (`credentialsSource`) — see `resolve-librefm-credentials.ts`. `ListenBrainzApi` is
 * simpler: ListenBrainz has no browser-authorization flow at all (see its own
 * docstring below), so there's no credentials/baked-in-key concept to mirror. Neither
 * exposes multi-account switching the way `AuthApi` does — this app connects at most
 * one account per service at a time, submitting to every currently-connected service
 * in parallel (see `apps/desktop/src/main/scrobbling/wire-scrobbling.ts`) rather than
 * switching between them. Same rule as `AuthApi`: never carries a session key/token
 * across the IPC boundary, only usernames.
 */
export interface LibrefmApi {
  /** Whether Libre.fm credentials are available at all right now — baked into this
   * build, or saved via Settings → Accounts. */
  isConfigured(): Promise<boolean>;
  /** Where the active Libre.fm API key/secret came from — `"environment"` (this build
   * has `LIBREFM_API_KEY`/`LIBREFM_API_SECRET` baked in, see
   * `resolve-librefm-credentials.ts`), `"user-supplied"` (saved via Settings →
   * Accounts), or `"none"`. Lets the UI decide whether to show the key-entry form at
   * all — same purpose as `AuthApi.credentialsSource()`. */
  credentialsSource(): Promise<"environment" | "user-supplied" | "none">;
  /** Saves a user-supplied Libre.fm API key/secret pair — the "bring your own key"
   * alternative for builds with no `LIBREFM_API_KEY`/`LIBREFM_API_SECRET` baked in.
   * Unlike `AuthApi.setAppCredentials`, takes effect immediately — Libre.fm's client
   * is constructed fresh from whichever source currently resolves (environment first,
   * see `credentialsSource`) at the moment `login()` is called, not fixed at app
   * startup, so there's no relaunch step needed. Throws if secure storage isn't
   * available on this system, or if either value is empty. */
  setCredentials(apiKey: string, apiSecret: string): Promise<void>;
  /** Clears a previously-saved Libre.fm API key/secret pair. A no-op on
   * `credentialsSource`/`login()` if `LIBREFM_API_KEY`/`LIBREFM_API_SECRET` are also
   * baked in — the environment source still takes precedence, same as
   * `AuthApi.clearAppCredentials()`. */
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

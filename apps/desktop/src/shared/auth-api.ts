/**
 * The renderer-facing account/auth API the preload script exposes via
 * `contextBridge.exposeInMainWorld("auth", ...)`. Deliberately never carries a session
 * key across the IPC boundary — only usernames — since the renderer runs web content
 * and is a larger attack surface than the main process; `LastfmClient` instances (and
 * the session keys they hold) live entirely in main.
 */
export interface AuthApi {
  /** Whether this build has Last.fm API credentials configured at all (see
   * docs/modules/desktop.md) — distinct from "no account logged in yet". */
  isConfigured(): Promise<boolean>;
  /** Where the active Last.fm API key/secret came from: `"environment"` (this build
   * has `LASTFM_API_KEY`/`LASTFM_API_SECRET` baked in), `"user-supplied"` (saved via
   * Settings → Accounts), or `"none"` (neither — login is unavailable until one is
   * configured). Lets Settings decide whether to offer "change/clear your key". */
  credentialsSource(): Promise<"environment" | "user-supplied" | "none">;
  /** Opens the user's browser to Last.fm's authorization page and resolves once
   * they've approved access there (no manual token entry). Throws if `isConfigured()`
   * would be false, or if the user doesn't approve within the timeout. */
  login(): Promise<{ username: string }>;
  logout(username: string): Promise<void>;
  listAccounts(): Promise<readonly string[]>;
  getActiveAccount(): Promise<string | undefined>;
  setActiveAccount(username: string): Promise<void>;
  /** Saves a user-supplied Last.fm API key/secret pair — the "bring your own key"
   * alternative for builds with no credentials baked in (or to switch away from
   * ones that are). Takes effect on the next launch; call `relaunch()` afterward
   * for it to apply immediately. Throws if secure storage isn't available on this
   * system, or if either value is empty. */
  setAppCredentials(apiKey: string, apiSecret: string): Promise<void>;
  /** Clears a previously-saved user-supplied API key/secret pair. Also takes effect
   * on the next launch. */
  clearAppCredentials(): Promise<void>;
  /** Restarts the app so newly-saved (or cleared) credentials take effect. */
  relaunch(): Promise<void>;
}

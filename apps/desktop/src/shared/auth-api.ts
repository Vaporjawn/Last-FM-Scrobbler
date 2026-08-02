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
  /** Opens the user's browser to Last.fm's authorization page and resolves once
   * they've approved access there (no manual token entry). Throws if `isConfigured()`
   * would be false, or if the user doesn't approve within the timeout. */
  login(): Promise<{ username: string }>;
  logout(username: string): Promise<void>;
  listAccounts(): Promise<readonly string[]>;
  getActiveAccount(): Promise<string | undefined>;
  setActiveAccount(username: string): Promise<void>;
}

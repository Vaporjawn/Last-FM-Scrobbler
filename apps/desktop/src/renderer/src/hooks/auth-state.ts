/**
 * The Last.fm authentication state `useAuth` exposes: whether API credentials exist and
 * where they came from, the logged-in accounts and which one is active, in-flight flags
 * for login and credential saving, and the latest error message.
 */
export interface AuthState {
  /** Whether this build has Last.fm API credentials configured at all. `undefined`
   * while still loading, so callers can distinguish "checking" from "unconfigured". */
  readonly isConfigured: boolean | undefined;
  /** Where the active API key/secret came from — `undefined` while still loading. See
   * `shared/auth-api.ts`. */
  readonly credentialsSource: "environment" | "user-supplied" | "none" | undefined;
  readonly accounts: readonly string[];
  readonly activeAccount: string | undefined;
  readonly isLoggingIn: boolean;
  readonly isSavingCredentials: boolean;
  readonly error: string | undefined;
}

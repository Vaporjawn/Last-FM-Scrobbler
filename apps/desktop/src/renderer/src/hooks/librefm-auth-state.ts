export interface LibrefmAuthState {
  /** Whether a Libre.fm API key/secret pair is available at all right now (baked in
   * or saved). `undefined` while still loading, so callers can distinguish "checking"
   * from "unconfigured" — same convention as `useAuth`'s `isConfigured`. */
  readonly isConfigured: boolean | undefined;
  /** Where the active key/secret came from — `undefined` while still loading. See
   * `shared/secondary-auth-api.ts`. */
  readonly credentialsSource: "environment" | "user-supplied" | "none" | undefined;
  /** The connected Libre.fm account's username, or `undefined` if none is connected.
   * Unlike `useAuth`, there's no `accounts` list/`setActiveAccount` — Libre.fm
   * connects at most one account at a time (see `LibrefmApi`'s docstring). */
  readonly activeAccount: string | undefined;
  readonly isLoggingIn: boolean;
  readonly isSavingCredentials: boolean;
  readonly error: string | undefined;
}

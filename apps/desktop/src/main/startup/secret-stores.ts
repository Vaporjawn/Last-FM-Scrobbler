import type { AccountStore, AppCredentialsStore } from "@lastfm-scrobbler/core";
import type { ResolvedLibrefmCredentials } from "../auth/resolve-librefm-credentials.js";

/**
 * Every store that needs OS-level secure storage. They all share one `safeStorage`, so they
 * are either all defined or all `undefined` together.
 */
export interface SecretStores {
  /** Last.fm per-user session keys. */
  readonly accountStore: AccountStore | undefined;
  /** A user-supplied Last.fm application key (bring-your-own-key). */
  readonly appCredentialsStore: AppCredentialsStore | undefined;
  /** Libre.fm per-user session keys. */
  readonly librefmAccountStore: AccountStore | undefined;
  /** A user-supplied Libre.fm application key. */
  readonly librefmAppCredentialsStore: AppCredentialsStore | undefined;
  /** ListenBrainz user tokens. */
  readonly listenbrainzAccountStore: AccountStore | undefined;
  /** Resolves the Libre.fm application key fresh on every call. */
  readonly resolveLibrefmAppCredentials: () => Promise<ResolvedLibrefmCredentials | undefined>;
}

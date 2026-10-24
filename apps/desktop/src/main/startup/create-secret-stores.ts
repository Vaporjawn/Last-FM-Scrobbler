import electron from "electron";
import { join } from "node:path";
import type { Logger } from "@lastfm-scrobbler/core";
import { createAccountStore } from "../auth/create-account-store.js";
import {
  resolveLibrefmCredentials,
  type ResolvedLibrefmCredentials,
} from "../auth/resolve-librefm-credentials.js";
import { createAppCredentialsStore } from "../lastfm/create-app-credentials-store.js";
import type { SecretStores } from "./secret-stores.js";

const { safeStorage } = electron;

/**
 * Creates every secure-storage-backed store (Last.fm, Libre.fm and ListenBrainz accounts,
 * and the two bring-your-own-key credential stores), logging a warning when secure storage
 * is unavailable so the user can see why login is disabled.
 */
export function createSecretStores(userDataDir: string, logger: Logger): SecretStores {
  const accountStore = createAccountStore({
    filePath: join(userDataDir, "secrets.json"),
    safeStorage,
  });
  if (!accountStore) {
    logger.warn("Secure account storage unavailable this run — login disabled.");
  }

  // A separate store/file from accountStore above: this holds a user-supplied
  // *application* credential (bring-your-own-key), not a per-user session key.
  const appCredentialsStore = createAppCredentialsStore({
    filePath: join(userDataDir, "app-credentials.json"),
    safeStorage,
  });
  if (!appCredentialsStore) {
    logger.warn("Secure storage unavailable this run — bring-your-own-key is disabled.");
  }

  // Libre.fm and ListenBrainz — additional scrobbling destinations connected
  // alongside Last.fm, not switched between (see wire-scrobbling.ts's docstring on
  // this app's "submit to all connected services at once" model). Separate
  // secret-storage files from Last.fm's own (secrets.json/app-credentials.json
  // above), via the same createAccountStore/createAppCredentialsStore factories —
  // `undefined` under the exact same condition accountStore/appCredentialsStore are
  // (they all share one `safeStorage`), so no separate warning is logged for these.
  const librefmAccountStore = createAccountStore({
    filePath: join(userDataDir, "librefm-secrets.json"),
    safeStorage,
  });
  const librefmAppCredentialsStore = createAppCredentialsStore({
    filePath: join(userDataDir, "librefm-app-credentials.json"),
    safeStorage,
  });
  const listenbrainzAccountStore = createAccountStore({
    filePath: join(userDataDir, "listenbrainz-secrets.json"),
    safeStorage,
  });
  // LIBREFM_API_KEY/LIBREFM_API_SECRET (baked into this build) take precedence,
  // falling back to a key the end user saved themselves — exact mirror of
  // resolvedCredentials/resolveLastfmCredentials below, just for Libre.fm. Kept as a
  // closure (not resolved once into a value) since wireSecondaryAuth calls this fresh
  // on every login/is-configured/credentials-source check — see that function's
  // resolveLibrefmCredentials option for why: unlike Last.fm's environment path,
  // Libre.fm needs no relaunch for a newly-saved key to apply.
  /** Looks up the current Libre.fm API key/secret on every call (see the comment above). */
  const resolveLibrefmAppCredentials = (): Promise<ResolvedLibrefmCredentials | undefined> =>
    resolveLibrefmCredentials({ librefmAppCredentialsStore });

  return {
    accountStore,
    appCredentialsStore,
    librefmAccountStore,
    librefmAppCredentialsStore,
    listenbrainzAccountStore,
    resolveLibrefmAppCredentials,
  };
}

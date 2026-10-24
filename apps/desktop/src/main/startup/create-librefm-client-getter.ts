import { buildLibrefmClient } from "../auth/build-librefm-client.js";
import type { SecretStores } from "./secret-stores.js";

/**
 * Returns an async getter for the active Libre.fm client, or `undefined` per call when no
 * account is connected or no application key is available. Read fresh on every call so a
 * newly connected account or saved key applies without a restart.
 */
export function createLibrefmClientGetter(secretStores: SecretStores) {
  return async () => {
    const { librefmAccountStore, resolveLibrefmAppCredentials } = secretStores;
    if (!librefmAccountStore) {
      return undefined;
    }
    const active = await librefmAccountStore.getActiveAccount();
    if (!active) {
      return undefined;
    }
    const credentials = await resolveLibrefmAppCredentials();
    if (!credentials) {
      return undefined;
    }
    return buildLibrefmClient(credentials, { sessionKey: active.sessionKey });
  };
}

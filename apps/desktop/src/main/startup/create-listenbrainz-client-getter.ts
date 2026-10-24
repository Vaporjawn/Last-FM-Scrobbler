import { ListenBrainzClient } from "@lastfm-scrobbler/core";
import type { SecretStores } from "./secret-stores.js";

/**
 * Returns an async getter for the active ListenBrainz client, or `undefined` per call when no
 * account is connected. Read fresh on every call so connecting an account applies without a
 * restart.
 */
export function createListenbrainzClientGetter(secretStores: SecretStores) {
  return async () => {
    const active = await secretStores.listenbrainzAccountStore?.getActiveAccount();
    return active ? new ListenBrainzClient({ token: active.sessionKey }) : undefined;
  };
}

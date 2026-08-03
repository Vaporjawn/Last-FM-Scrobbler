import type { AppCredentials, AuthFlowClient } from "@lastfm-scrobbler/core";
import { buildLibrefmClient } from "./build-librefm-client.js";

/** The real default for `WireSecondaryAuthOptions.createLibrefmAuthFlowClient` — see
 * `buildLibrefmClient`. */
export function createLibrefmAuthFlowClient(credentials: AppCredentials): AuthFlowClient {
  return buildLibrefmClient(credentials);
}

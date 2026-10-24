import { join } from "node:path";
import {
  LastfmClient,
  NetworkStatusMonitor,
  ScrobbleQueue,
  type AccountStore,
  type AppCredentialsStore,
  type Logger,
} from "@lastfm-scrobbler/core";
import { resolveLastfmCredentials } from "../lastfm/resolve-lastfm-credentials.js";
import type { LastfmServices } from "./lastfm-services.js";

/** What `createLastfmServices` needs from the rest of startup. */
export interface CreateLastfmServicesOptions {
  readonly userDataDir: string;
  readonly accountStore: AccountStore | undefined;
  readonly appCredentialsStore: AppCredentialsStore | undefined;
  readonly logger: Logger;
}

/**
 * Resolves the Last.fm application credentials, builds the unsigned client and the
 * session-client factory from them, and opens the scrobble queue and network monitor. A
 * missing application key is not fatal: the app still launches and login reports "not
 * configured".
 */
export async function createLastfmServices(
  options: CreateLastfmServicesOptions,
): Promise<LastfmServices> {
  const { userDataDir, accountStore, appCredentialsStore, logger } = options;

  const resolvedCredentials = await resolveLastfmCredentials({ appCredentialsStore });
  const lastfmClient = resolvedCredentials
    ? new LastfmClient({
        apiKey: resolvedCredentials.apiKey,
        apiSecret: resolvedCredentials.apiSecret,
      })
    : undefined;
  if (!lastfmClient) {
    logger.warn("Last.fm API credentials not configured this run — login disabled.");
  }

  // Constructed here (rather than inside the `if (accountStore)` block further down,
  // where the queue used to live) so wireAuth/wireLastfmData/wireTrackActions below —
  // called before that block — can report to the same shared monitor as scrobbling
  // does. `networkStatus` stays `undefined` under the exact same condition
  // `scrobbleQueue` does (both need secure storage), so the offline-mode status
  // surface (see main/network/wire-network-status.ts, wired further down) is simply
  // inert — never pushed to, never claiming a real online/offline state — in a build
  // with no secure storage available, rather than reporting anything misleading.
  const scrobbleQueue = accountStore
    ? new ScrobbleQueue({ databasePath: join(userDataDir, "scrobble-queue.sqlite3") })
    : undefined;
  const networkStatus = scrobbleQueue
    ? new NetworkStatusMonitor({ queue: scrobbleQueue })
    : undefined;

  // Shared by scrobble submission and the signed track actions (love/unlove/addTags)
  // below — both need a client signed with a *specific account's* session key, which
  // is only known once a login has happened, unlike `lastfmClient` above (unsigned,
  // used for public reads only).
  const createSessionClient = resolvedCredentials
    ? (sessionKey: string) =>
        new LastfmClient({
          apiKey: resolvedCredentials.apiKey,
          apiSecret: resolvedCredentials.apiSecret,
          sessionKey,
        })
    : undefined;

  return {
    resolvedCredentials,
    lastfmClient,
    createSessionClient,
    scrobbleQueue,
    networkStatus,
    accountStore,
  };
}

import type {
  AccountStore,
  LastfmClient,
  NetworkStatusMonitor,
  ScrobbleQueue,
} from "@lastfm-scrobbler/core";
import type { ResolvedLastfmCredentials } from "../lastfm/resolve-lastfm-credentials.js";

/** The Last.fm client, the offline queue and the shared network monitor built at startup. */
export interface LastfmServices {
  /** Where the application key came from; `undefined` when none is configured. */
  readonly resolvedCredentials: ResolvedLastfmCredentials | undefined;
  /** Unsigned client for public reads; `undefined` when no application key is configured. */
  readonly lastfmClient: LastfmClient | undefined;
  /** Builds a client signed with one account's session key. */
  readonly createSessionClient: ((sessionKey: string) => LastfmClient) | undefined;
  /** The persistent scrobble queue; `undefined` without secure storage. */
  readonly scrobbleQueue: ScrobbleQueue | undefined;
  /** The shared online/offline monitor; `undefined` under the same condition as the queue. */
  readonly networkStatus: NetworkStatusMonitor | undefined;
  /** The account store the queue's presence depends on. */
  readonly accountStore: AccountStore | undefined;
}

export type { EligibilityInput } from "./rules/is-eligible-for-scrobble.js";
export {
  isEligibleForScrobble,
  MAX_ELIGIBILITY_THRESHOLD_SEC,
} from "./rules/is-eligible-for-scrobble.js";
export type {
  PendingScrobble,
  QueuedScrobble,
  ScrobbleQueueOptions,
} from "./queue/scrobble-queue.js";
export { ScrobbleQueue } from "./queue/scrobble-queue.js";
export { LastfmClient } from "./lastfm-api/client.js";
export type { LastfmClientOptions } from "./lastfm-api/client.js";
export {
  LastfmApiError,
  isRetryableApiErrorCode,
  isRetryableScrobbleIgnoreCode,
} from "./lastfm-api/lastfm-error.js";
export { signRequest } from "./lastfm-api/sign-request.js";
export type {
  ArtistInfo,
  Friend,
  LastfmSession,
  NowPlayingSubmission,
  RecentTrack,
  ScrobbleBatchResult,
  ScrobbleResultItem,
  ScrobbleSubmission,
  SimilarArtist,
  TopArtist,
  TrackRef,
} from "./lastfm-api/types.js";
export { AccountStore } from "./auth/account-store.js";
export type { StoredAccount } from "./auth/account-store.js";
export type { SecretStorage } from "./auth/secret-storage.js";
export { AuthFlow, AuthTimeoutError } from "./auth/auth-flow.js";
export type { AuthFlowClient, AuthFlowOptions } from "./auth/auth-flow.js";
export { compileFilter, FilterSyntaxError } from "./filters/filter-expression.js";
export type { CompiledFilter, FilterableTrack } from "./filters/filter-expression.js";
export { Tracker } from "./tracker/tracker.js";
export type {
  ScrobbleEligibleEvent,
  TrackChangedEvent,
  TrackerEvents,
  TrackerOptions,
} from "./tracker/tracker.js";
export { computeTrackIdentity } from "./tracker/track-identity.js";
export { Logger } from "./logging/logger.js";
export type { LogEntry, LoggerOptions, LogLevel, LogSeverity } from "./logging/logger.js";

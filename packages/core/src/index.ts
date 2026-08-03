export type { EligibilityInput } from "./rules/is-eligible-for-scrobble.js";
export {
  isEligibleForScrobble,
  MAX_ELIGIBILITY_THRESHOLD_SEC,
} from "./rules/is-eligible-for-scrobble.js";
export type {
  LikelyNonMusicVideoInput,
  LikelyNonMusicVideoOptions,
} from "./rules/is-likely-non-music-video.js";
export {
  DEFAULT_NON_MUSIC_VIDEO_THRESHOLD_SEC,
  isLikelyNonMusicVideo,
} from "./rules/is-likely-non-music-video.js";
export { combineFilters } from "./filters/combine-filters.js";
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
  TopAlbum,
  TopAlbumsPeriod,
  TopArtist,
  TopArtistsPeriod,
  TopTrack,
  TopTracksPeriod,
  TrackDetail,
  TrackRef,
  UserProfile,
} from "./lastfm-api/types.js";
export { fetchArtistImageUrl } from "./artist-images/fetch-artist-image-url.js";
export { AccountStore } from "./auth/account-store.js";
export type { AccountStoreOptions, StoredAccount } from "./auth/account-store.js";
export { AppCredentialsStore } from "./auth/app-credentials-store.js";
export type { AppCredentials, AppCredentialsStoreOptions } from "./auth/app-credentials-store.js";
export type { SecretStorage } from "./auth/secret-storage.js";
export type { ScrobblingClient } from "./scrobbling-client.js";
export { ListenBrainzClient } from "./listenbrainz-api/client.js";
export type { ListenBrainzClientOptions } from "./listenbrainz-api/client.js";
export { ListenBrainzApiError } from "./listenbrainz-api/listenbrainz-error.js";
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

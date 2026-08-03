import type { NowPlayingSubmission, ScrobbleBatchResult, ScrobbleSubmission } from "./lastfm-api/types.js";

/**
 * The minimal, service-agnostic surface `apps/desktop/src/main/scrobbling/wire-scrobbling.ts`
 * needs to submit scrobbles/now-playing updates to any connected service. `LastfmClient`
 * satisfies this structurally (used as-is for both Last.fm and Libre.fm — protocol-identical,
 * see `LastfmClientOptions.baseUrl`), and `ListenBrainzClient` implements it directly.
 *
 * Deliberately a standalone interface rather than indexed-access types off `LastfmClient`
 * (e.g. `LastfmClient["scrobble"]`, this project's original shape before multi-service
 * support): that tied every scrobbling-capable client to `LastfmClient`'s own method
 * signatures even though nothing about "submit these scrobbles" is Last.fm-specific.
 */
export interface ScrobblingClient {
  updateNowPlaying(submission: NowPlayingSubmission): Promise<void>;
  scrobble(submissions: readonly ScrobbleSubmission[]): Promise<ScrobbleBatchResult>;
}

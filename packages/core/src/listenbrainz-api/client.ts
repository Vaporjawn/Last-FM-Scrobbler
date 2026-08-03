import { ListenBrainzApiError } from "./listenbrainz-error.js";
import type { ScrobblingClient } from "../scrobbling-client.js";
import type {
  NowPlayingSubmission,
  ScrobbleBatchResult,
  ScrobbleSubmission,
} from "../lastfm-api/types.js";

const DEFAULT_BASE_URL = "https://api.listenbrainz.org";
/** ListenBrainz's own documented per-request limit (`MAX_LISTENS_PER_REQUEST` in their
 * source) — verified against their official docs (listenbrainz.readthedocs.io). Well
 * above `apps/desktop/src/main/scrobbling/wire-scrobbling.ts`'s 50-item drain batch, so
 * this is defensive parity with `LastfmClient.scrobble`'s equivalent guard, not
 * expected to trigger in practice. */
const MAX_LISTENS_PER_REQUEST = 1000;

export interface ListenBrainzClientOptions {
  /** A ListenBrainz user API token — pasted in by the user from their ListenBrainz
   * profile settings page (see `ListenBrainzClient.validateToken`), not obtained via a
   * browser-authorization flow like `AuthFlow`/Last.fm/Libre.fm — ListenBrainz has no
   * such flow, just a per-account static token. */
  readonly token: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

interface TrackMetadata {
  readonly artist_name: string;
  readonly track_name: string;
  readonly release_name?: string;
}

interface ListenPayload {
  readonly listened_at?: number;
  readonly track_metadata: TrackMetadata;
}

function toTrackMetadata(submission: {
  readonly artist: string;
  readonly track: string;
  readonly album?: string;
}): TrackMetadata {
  return {
    artist_name: submission.artist,
    track_name: submission.track,
    ...(submission.album ? { release_name: submission.album } : {}),
  };
}

/**
 * Minimal client for ListenBrainz's `submit-listens` API
 * (https://listenbrainz.readthedocs.io/en/latest/users/api/core.html) — implements
 * `ScrobblingClient` so `wire-scrobbling.ts` can fan a drained batch out to ListenBrainz
 * the same way it does to a Last.fm-protocol client (`LastfmClient`).
 *
 * Verified live this session: `POST /1/submit-listens` accepts `listen_type:
 * "playing_now" | "single"` with a JSON `payload` array (batched submission of
 * multiple listens per request *is* supported for regular, non-import use — confirmed
 * documented limits: `MAX_LISTENS_PER_REQUEST = 1000`, well above what this app ever
 * sends at once); auth is a static per-account token via an `Authorization: Token
 * <token>` header (no OAuth, no browser flow); `GET /1/validate-token?token=…` — see
 * `validateToken` — returned exactly its documented shape for a live (fake) token.
 * `submit-listens`'s own error response shape was *not* independently live-verified
 * this session (a real verification attempt hit Cloudflare rate-limiting before
 * completing, and wasn't retried further to avoid hammering a real third-party
 * service) — `request` below parses error messages defensively from either an
 * `error` or `message` body field rather than assuming one specific shape, and treats
 * `response.ok` (the HTTP status) as the one reliable success/failure signal.
 */
export class ListenBrainzClient implements ScrobblingClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ListenBrainzClientOptions) {
    this.token = options.token;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(
    path: string,
    init: {
      readonly method: string;
      readonly headers?: Record<string, string>;
      readonly body?: string;
    },
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: init.method,
      ...(init.body !== undefined ? { body: init.body } : {}),
      headers: {
        ...init.headers,
        authorization: `Token ${this.token}`,
      },
    });

    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const body = payload as { error?: string; message?: string } | undefined;
      throw new ListenBrainzApiError(
        response.status,
        body?.error ??
          body?.message ??
          `ListenBrainz request failed with status ${response.status}`,
      );
    }
    return payload as T;
  }

  async updateNowPlaying(submission: NowPlayingSubmission): Promise<void> {
    const payload: ListenPayload[] = [{ track_metadata: toTrackMetadata(submission) }];
    await this.request("/1/submit-listens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listen_type: "playing_now", payload }),
    });
  }

  async scrobble(submissions: readonly ScrobbleSubmission[]): Promise<ScrobbleBatchResult> {
    if (submissions.length === 0) {
      return { accepted: 0, ignored: 0, results: [] };
    }
    if (submissions.length > MAX_LISTENS_PER_REQUEST) {
      throw new Error(
        `ListenBrainzClient.scrobble: batch of ${submissions.length} exceeds ListenBrainz's limit of ${MAX_LISTENS_PER_REQUEST}`,
      );
    }

    const payload: ListenPayload[] = submissions.map((submission) => ({
      listened_at: submission.timestamp,
      track_metadata: toTrackMetadata(submission),
    }));

    // ListenBrainz's submit-listens response carries no per-listen accept/ignore
    // detail (unlike Last.fm's track.scrobble) — a 2xx response means the whole batch
    // was accepted, so every submission maps to an accepted ScrobbleResultItem. A
    // partial/whole-batch rejection surfaces as a thrown ListenBrainzApiError instead
    // (see `request` above), same convention `LastfmClient.scrobble` uses for its own
    // whole-batch failure paths.
    await this.request("/1/submit-listens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listen_type: "single", payload }),
    });

    return {
      accepted: submissions.length,
      ignored: 0,
      results: submissions.map((submission) => ({
        track: submission.track,
        ignoredCode: 0,
        retryable: false,
      })),
    };
  }

  /**
   * Validates `token` (a candidate ListenBrainz user API token — not necessarily
   * `this.token`, so this can be called *before* committing to a token, e.g. from a
   * "Connect" form field) and resolves the account it belongs to. Verified live this
   * session against the real API: `GET /1/validate-token?token=<token>` returns
   * `{code, message, valid, user_name}` — a genuinely invalid token comes back as
   * `{"code":200,"message":"Token invalid.","valid":false}` (HTTP 200 wrapping a
   * `valid: false`, not a 4xx — this method checks the `valid` field, not the HTTP
   * status, for exactly that reason).
   */
  async validateToken(token: string): Promise<{ valid: boolean; username?: string }> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/1/validate-token?token=${encodeURIComponent(token)}`,
    );
    const result = (await response.json()) as { valid?: boolean; user_name?: string };
    return {
      valid: result.valid === true,
      ...(result.valid === true && result.user_name ? { username: result.user_name } : {}),
    };
  }
}

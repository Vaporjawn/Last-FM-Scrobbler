import { createTimeoutSignal, DEFAULT_REQUEST_TIMEOUT_MS } from "../network/request-timeout.js";
import { ListenBrainzApiError } from "./listenbrainz-error.js";
import type { ScrobblingClient } from "../scrobbling-client.js";
import type {
  NowPlayingSubmission,
  ScrobbleBatchResult,
  ScrobbleSubmission,
} from "../lastfm-api/types.js";
import { type TrackMetadata } from "./track-metadata.js";
import { toTrackMetadata } from "./to-track-metadata.js";

const DEFAULT_BASE_URL = "https://api.listenbrainz.org";
/** ListenBrainz's own documented per-request limit (`MAX_LISTENS_PER_REQUEST` in their
 * source) — verified against their official docs (listenbrainz.readthedocs.io). Well
 * above `apps/desktop/src/main/scrobbling/wire-scrobbling.ts`'s 50-item drain batch, so
 * this is defensive parity with `LastfmClient.scrobble`'s equivalent guard, not
 * expected to trigger in practice. */
const MAX_LISTENS_PER_REQUEST = 1000;
/** Construction options for `ListenBrainzClient`: the user's API token is required; base URL, `fetch` and timeout can be overridden (tests, self-hosted servers). */
export interface ListenBrainzClientOptions {
  /** A ListenBrainz user API token — pasted in by the user from their ListenBrainz
   * profile settings page (see `ListenBrainzClient.validateToken`), not obtained via a
   * browser-authorization flow like `AuthFlow`/Last.fm/Libre.fm — ListenBrainz has no
   * such flow, just a per-account static token. */
  readonly token: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  /** Per-request ceiling in milliseconds; defaults to 30 seconds. */
  readonly timeoutMs?: number;
}
/**
 * One element of the `payload` array in a `submit-listens` request body. `listened_at`
 * (Unix seconds) is present for a finished listen and left out for a `playing_now` update.
 */
interface ListenPayload {
  readonly listened_at?: number;
  readonly track_metadata: TrackMetadata;
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
  private readonly timeoutMs: number;

  /** Applies defaults: the public ListenBrainz API URL, the global `fetch`, and the shared default request timeout. */
  constructor(options: ListenBrainzClientOptions) {
    this.token = options.token;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  /**
   * Sends one authenticated call (`Authorization: Token ...`) to `path` under the base
   * URL and returns the parsed JSON body. The HTTP status decides success: any non-2xx
   * response becomes a `ListenBrainzApiError` carrying that status and the best message
   * found in the body. A body that is not JSON is tolerated (treated as empty) so it
   * cannot mask the real status error.
   *
   * @throws ListenBrainzApiError - On a non-2xx response.
   * @throws Error - Network failure or timeout, propagated from `fetch`.
   */
  private async request<T>(
    path: string,
    init: {
      readonly method: string;
      readonly headers?: Record<string, string>;
      readonly body: string;
    },
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: init.method,
      body: init.body,
      signal: createTimeoutSignal(this.timeoutMs),
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

  /**
   * Posts to `/1/submit-listens` with `listen_type: "playing_now"` and a single payload
   * entry. Only artist, track and album are sent; ListenBrainz's metadata mapping
   * ignores the other submission fields.
   *
   * @throws ListenBrainzApiError - If ListenBrainz answers with a non-2xx status.
   */
  async updateNowPlaying(submission: NowPlayingSubmission): Promise<void> {
    const payload: ListenPayload[] = [{ track_metadata: toTrackMetadata(submission) }];
    await this.request("/1/submit-listens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listen_type: "playing_now", payload }),
    });
  }

  /**
   * Posts the batch to `/1/submit-listens` as `listen_type: "single"`, using each
   * submission's timestamp as `listened_at`. ListenBrainz does not report per-listen
   * outcomes, so a successful call marks every item accepted (none ignored, none
   * retryable) and any failure rejects the whole batch. An empty batch returns an empty
   * result without a request.
   *
   * @throws Error - If the batch exceeds 1000 listens, the per-request limit.
   * @throws ListenBrainzApiError - If ListenBrainz answers with a non-2xx status.
   */
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
      { signal: createTimeoutSignal(this.timeoutMs) },
    );
    const result = (await response.json()) as { valid?: boolean; user_name?: string };
    return {
      valid: result.valid === true,
      ...(result.valid === true && result.user_name ? { username: result.user_name } : {}),
    };
  }
}

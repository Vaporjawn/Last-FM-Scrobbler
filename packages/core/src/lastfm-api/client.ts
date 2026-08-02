import { LastfmApiError, isRetryableScrobbleIgnoreCode } from "./lastfm-error.js";
import { signRequest } from "./sign-request.js";
import type {
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
} from "./types.js";

const DEFAULT_BASE_URL = "https://ws.audioscrobbler.com/2.0/";
const MAX_SCROBBLE_BATCH_SIZE = 50;

export interface LastfmClientOptions {
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly sessionKey?: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

interface RequestOptions {
  readonly httpMethod: "GET" | "POST";
  readonly signed: boolean;
}

/** Narrow, structural check — real Last.fm errors always have both fields. */
function isErrorPayload(value: unknown): value is { error: number; message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    "message" in value &&
    typeof (value as { error: unknown }).error === "number"
  );
}

export class LastfmClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly sessionKey: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: LastfmClientOptions) {
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret;
    this.sessionKey = options.sessionKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(
    method: string,
    extraParams: Readonly<Record<string, string>>,
    options: RequestOptions,
  ): Promise<T> {
    const params: Record<string, string> = {
      method,
      api_key: this.apiKey,
      ...extraParams,
    };

    if (options.signed) {
      params.api_sig = signRequest(params, this.apiSecret);
    }
    params.format = "json";

    let response: Response;
    if (options.httpMethod === "GET") {
      const url = new URL(this.baseUrl);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
      response = await this.fetchImpl(url.toString());
    } else {
      response = await this.fetchImpl(this.baseUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString(),
      });
    }

    const payload: unknown = await response.json();
    if (isErrorPayload(payload)) {
      throw new LastfmApiError(payload.error, payload.message);
    }
    return payload as T;
  }

  private signedParams(extra: Readonly<Record<string, string>> = {}): Record<string, string> {
    if (!this.sessionKey) {
      throw new Error("LastfmClient: this operation requires a session key");
    }
    return { ...extra, sk: this.sessionKey };
  }

  // --- auth -----------------------------------------------------------------

  async getAuthToken(): Promise<string> {
    const result = await this.request<{ token: string }>(
      "auth.getToken",
      {},
      { httpMethod: "GET", signed: true },
    );
    return result.token;
  }

  /** Builds the URL the user must open in a browser to grant access for `token`. */
  buildAuthUrl(token: string): string {
    const url = new URL("https://www.last.fm/api/auth/");
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("token", token);
    return url.toString();
  }

  async getSession(token: string): Promise<LastfmSession> {
    const result = await this.request<{
      session: { name: string; key: string; subscriber: number | string };
    }>("auth.getSession", { token }, { httpMethod: "GET", signed: true });

    return {
      username: result.session.name,
      sessionKey: result.session.key,
      isSubscriber: Number(result.session.subscriber) === 1,
    };
  }

  // --- track (write) ----------------------------------------------------------

  async updateNowPlaying(submission: NowPlayingSubmission): Promise<void> {
    const params: Record<string, string> = {
      artist: submission.artist,
      track: submission.track,
      ...(submission.album !== undefined ? { album: submission.album } : {}),
      ...(submission.albumArtist !== undefined ? { albumArtist: submission.albumArtist } : {}),
      ...(submission.durationSec !== undefined
        ? { duration: String(submission.durationSec) }
        : {}),
      ...(submission.trackNumber !== undefined
        ? { trackNumber: String(submission.trackNumber) }
        : {}),
      ...(submission.mbid !== undefined ? { mbid: submission.mbid } : {}),
    };
    await this.request(
      "track.updateNowPlaying",
      this.signedParams(params),
      { httpMethod: "POST", signed: true },
    );
  }

  async scrobble(submissions: readonly ScrobbleSubmission[]): Promise<ScrobbleBatchResult> {
    if (submissions.length > MAX_SCROBBLE_BATCH_SIZE) {
      throw new Error(
        `LastfmClient.scrobble: batch of ${submissions.length} exceeds Last.fm's limit of ${MAX_SCROBBLE_BATCH_SIZE}`,
      );
    }

    const params: Record<string, string> = {};
    submissions.forEach((submission, index) => {
      params[`artist[${index}]`] = submission.artist;
      params[`track[${index}]`] = submission.track;
      params[`timestamp[${index}]`] = String(submission.timestamp);
      if (submission.album !== undefined) {
        params[`album[${index}]`] = submission.album;
      }
      if (submission.albumArtist !== undefined) {
        params[`albumArtist[${index}]`] = submission.albumArtist;
      }
      if (submission.durationSec !== undefined) {
        params[`duration[${index}]`] = String(submission.durationSec);
      }
      if (submission.trackNumber !== undefined) {
        params[`trackNumber[${index}]`] = String(submission.trackNumber);
      }
      if (submission.mbid !== undefined) {
        params[`mbid[${index}]`] = submission.mbid;
      }
    });

    const result = await this.request<{
      scrobbles: {
        "@attr": { accepted: number | string; ignored: number | string };
        scrobble: ScrobbleResponseItemJson | readonly ScrobbleResponseItemJson[];
      };
    }>("track.scrobble", this.signedParams(params), { httpMethod: "POST", signed: true });

    const rawScrobbles = result.scrobbles.scrobble;
    const items: readonly ScrobbleResponseItemJson[] = Array.isArray(rawScrobbles)
      ? rawScrobbles
      : [rawScrobbles];
    const results: ScrobbleResultItem[] = items.map((item) => {
      const ignoredCode = Number(item.ignoredMessage.code);
      return {
        track: item.track["#text"],
        ignoredCode,
        retryable: ignoredCode === 0 ? false : isRetryableScrobbleIgnoreCode(ignoredCode),
      };
    });

    return {
      accepted: Number(result.scrobbles["@attr"].accepted),
      ignored: Number(result.scrobbles["@attr"].ignored),
      results,
    };
  }

  async love(track: TrackRef): Promise<void> {
    await this.request(
      "track.love",
      this.signedParams({ artist: track.artist, track: track.track }),
      { httpMethod: "POST", signed: true },
    );
  }

  async unlove(track: TrackRef): Promise<void> {
    await this.request(
      "track.unlove",
      this.signedParams({ artist: track.artist, track: track.track }),
      { httpMethod: "POST", signed: true },
    );
  }

  async addTags(track: TrackRef & { readonly tags: readonly string[] }): Promise<void> {
    await this.request(
      "track.addTags",
      this.signedParams({
        artist: track.artist,
        track: track.track,
        tags: track.tags.join(","),
      }),
      { httpMethod: "POST", signed: true },
    );
  }

  // --- user / artist (read) ----------------------------------------------------

  async getRecentTracks(options: {
    readonly user: string;
    readonly limit?: number;
  }): Promise<RecentTrack[]> {
    const params: Record<string, string> = { user: options.user };
    if (options.limit !== undefined) {
      params.limit = String(options.limit);
    }

    const result = await this.request<{
      recenttracks: { track: RecentTrackJson | readonly RecentTrackJson[] };
    }>("user.getRecentTracks", params, { httpMethod: "GET", signed: false });

    const raw = result.recenttracks.track;
    const items: readonly RecentTrackJson[] = Array.isArray(raw) ? raw : [raw];
    return items.map((item) => {
      const nowPlaying = item["@attr"]?.nowplaying === "true";
      return {
        artist: item.artist["#text"],
        track: item.name,
        ...(item.album?.["#text"] ? { album: item.album["#text"] } : {}),
        nowPlaying,
        ...(nowPlaying ? {} : { timestamp: Number(item.date?.uts) }),
      };
    });
  }

  async getTopArtists(options: {
    readonly user: string;
    readonly period?: "overall" | "7day" | "1month" | "3month" | "6month" | "12month";
    readonly limit?: number;
  }): Promise<TopArtist[]> {
    const params: Record<string, string> = { user: options.user };
    if (options.period !== undefined) {
      params.period = options.period;
    }
    if (options.limit !== undefined) {
      params.limit = String(options.limit);
    }

    const result = await this.request<{
      topartists: { artist: TopArtistJson | readonly TopArtistJson[] };
    }>("user.getTopArtists", params, { httpMethod: "GET", signed: false });

    const raw = result.topartists.artist;
    const items: readonly TopArtistJson[] = Array.isArray(raw) ? raw : [raw];
    return items.map((item) => ({ name: item.name, playCount: Number(item.playcount) }));
  }

  async getFriends(options: { readonly user: string }): Promise<Friend[]> {
    const result = await this.request<{
      friends: { user: FriendJson | readonly FriendJson[] };
    }>("user.getFriends", { user: options.user }, { httpMethod: "GET", signed: false });

    const raw = result.friends.user;
    const items: readonly FriendJson[] = Array.isArray(raw) ? raw : [raw];
    return items.map((item) => ({
      username: item.name,
      ...(item.realname ? { realName: item.realname } : {}),
    }));
  }

  async getArtistInfo(options: { readonly artist: string }): Promise<ArtistInfo> {
    const result = await this.request<{
      artist: {
        name: string;
        bio?: { summary?: string };
        stats: { listeners: string; playcount: string };
      };
    }>("artist.getInfo", { artist: options.artist }, { httpMethod: "GET", signed: false });

    return {
      name: result.artist.name,
      ...(result.artist.bio?.summary ? { bioSummary: result.artist.bio.summary } : {}),
      listeners: Number(result.artist.stats.listeners),
      playCount: Number(result.artist.stats.playcount),
    };
  }

  async getSimilarArtists(options: {
    readonly artist: string;
    readonly limit?: number;
  }): Promise<SimilarArtist[]> {
    const params: Record<string, string> = { artist: options.artist };
    if (options.limit !== undefined) {
      params.limit = String(options.limit);
    }

    const result = await this.request<{
      similarartists: { artist: SimilarArtistJson | readonly SimilarArtistJson[] };
    }>("artist.getSimilar", params, { httpMethod: "GET", signed: false });

    const raw = result.similarartists.artist;
    const items: readonly SimilarArtistJson[] = Array.isArray(raw) ? raw : [raw];
    return items.map((item) => ({ name: item.name, match: Number(item.match) }));
  }
}

interface RecentTrackJson {
  readonly artist: { readonly "#text": string };
  readonly name: string;
  readonly album?: { readonly "#text": string };
  readonly date?: { readonly uts: string };
  readonly "@attr"?: { readonly nowplaying?: string };
}

interface ScrobbleResponseItemJson {
  readonly track: { readonly "#text": string };
  readonly ignoredMessage: { readonly code: string };
}

interface TopArtistJson {
  readonly name: string;
  readonly playcount: string;
}

interface FriendJson {
  readonly name: string;
  readonly realname?: string;
}

interface SimilarArtistJson {
  readonly name: string;
  readonly match: string;
}

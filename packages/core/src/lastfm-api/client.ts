import { isRetryableScrobbleIgnoreCode } from "./is-retryable-scrobble-ignore-code.js";
import { LastfmApiError } from "./lastfm-error.js";
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
  TopAlbum,
  TopAlbumsPeriod,
  TopArtist,
  TopArtistsPeriod,
  TopTrack,
  TopTracksPeriod,
  TrackDetail,
  TrackRef,
  UserProfile,
} from "./types.js";

const DEFAULT_BASE_URL = "https://ws.audioscrobbler.com/2.0/";
const DEFAULT_AUTH_URL = "https://www.last.fm/api/auth/";
const MAX_SCROBBLE_BATCH_SIZE = 50;

/** Last.fm's own shared "no photo" placeholder for `artist.getInfo`'s `image` array —
 * verified live against the real API: every size's `#text` points to this exact same
 * generic graphic, regardless of which artist was requested, a known, long-standing
 * issue on Last.fm's side (see `ArtistInfo`'s docstring in `types.ts` for the full
 * writeup and citation). Used by `getArtistImageUrl` to filter it out rather than
 * returning it as if it were a real photo. */
const LASTFM_ARTIST_IMAGE_PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

export interface LastfmClientOptions {
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly sessionKey?: string;
  readonly baseUrl?: string;
  /** The browser page a user is sent to in order to grant this app access — see
   * `buildAuthUrl`. Defaults to Last.fm's own authorization page. Only needs
   * overriding when this client is pointed at a different Audioscrobbler-protocol
   * service via `baseUrl` (e.g. Libre.fm — see
   * `apps/desktop/src/main/auth/wire-secondary-auth.ts`), since that service's own
   * authorization page lives on its own domain, not `baseUrl`'s API host (Last.fm
   * itself splits these the same way: API calls go to `ws.audioscrobbler.com`, but
   * the auth page is on `www.last.fm`). **Not independently live-verified for
   * Libre.fm this session** — see `wire-secondary-auth.ts`'s docstring for what was
   * and wasn't confirmed against Libre.fm's real service. */
  readonly authUrl?: string;
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

/**
 * Thin wrapper over the Last.fm/Audioscrobbler REST API (auth, scrobbling, and the
 * read-only profile/artist/track lookups the renderer's pages need) — every write call
 * is signed per `signRequest`, every response checked via `isErrorPayload` and thrown
 * as a `LastfmApiError` on failure. Also the concrete client Libre.fm's identical-
 * protocol service reuses (see `LastfmClientOptions.baseUrl`/`authUrl`), so nothing
 * here should assume "Last.fm" beyond the default URLs.
 */
export class LastfmClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly sessionKey: string | undefined;
  private readonly baseUrl: string;
  private readonly authUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: LastfmClientOptions) {
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret;
    this.sessionKey = options.sessionKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.authUrl = options.authUrl ?? DEFAULT_AUTH_URL;
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

  /** Builds the URL the user must open in a browser to grant access for `token` — see
   * `LastfmClientOptions.authUrl`. */
  buildAuthUrl(token: string): string {
    const url = new URL(this.authUrl);
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
      ...(submission.durationSec !== undefined ? { duration: String(submission.durationSec) } : {}),
      ...(submission.trackNumber !== undefined
        ? { trackNumber: String(submission.trackNumber) }
        : {}),
      ...(submission.mbid !== undefined ? { mbid: submission.mbid } : {}),
    };
    await this.request("track.updateNowPlaying", this.signedParams(params), {
      httpMethod: "POST",
      signed: true,
    });
  }

  async scrobble(submissions: readonly ScrobbleSubmission[]): Promise<ScrobbleBatchResult> {
    // Mirrors `ListenBrainzClient.scrobble`'s equivalent guard. Without it, an empty
    // batch still hit the network: Last.fm's `track.scrobble` response shape for zero
    // items doesn't include a `scrobble` field at all, so `result.scrobbles.scrobble`
    // is `undefined` and the `.map` below throws a raw `TypeError` instead of this
    // client ever getting the chance to return a clean, empty result.
    if (submissions.length === 0) {
      return { accepted: 0, ignored: 0, results: [] };
    }
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

  /** `page` is 1-based, same convention Last.fm's own API uses — verified live
   * against the real API (`user.getRecentTracks`, `format=json`, `page=2`): the
   * response's `@attr.page` echoes back whichever page was requested, and each
   * page's `track` items follow the exact same shape as page 1. Omitted entirely
   * (Last.fm defaults to page 1) when not given, same convention as `limit`. */
  async getRecentTracks(options: {
    readonly user: string;
    readonly limit?: number;
    readonly page?: number;
  }): Promise<RecentTrack[]> {
    // extended=1 is what makes Last.fm include `loved` and real per-track artwork on
    // this endpoint at all — see RecentTrackJson's docstring for the response-shape
    // trade-off it brings (the `artist` field changes shape under extended mode).
    const params: Record<string, string> = { user: options.user, extended: "1" };
    if (options.limit !== undefined) {
      params.limit = String(options.limit);
    }
    if (options.page !== undefined) {
      params.page = String(options.page);
    }

    const result = await this.request<{
      recenttracks: { track: RecentTrackJson | readonly RecentTrackJson[] };
    }>("user.getRecentTracks", params, { httpMethod: "GET", signed: false });

    const raw = result.recenttracks.track;
    const items: readonly RecentTrackJson[] = Array.isArray(raw) ? raw : [raw];
    return items.map((item) => {
      const nowPlaying = item["@attr"]?.nowplaying === "true";
      const imageUrl = pickLargestImageUrl(item.image);
      return {
        artist: item.artist.name ?? item.artist["#text"] ?? "",
        track: item.name,
        ...(item.album?.["#text"] ? { album: item.album["#text"] } : {}),
        nowPlaying,
        ...(nowPlaying ? {} : { timestamp: Number(item.date?.uts) }),
        ...(imageUrl ? { imageUrl } : {}),
        loved: item.loved === "1",
      };
    });
  }

  async getTopArtists(options: {
    readonly user: string;
    readonly period?: TopArtistsPeriod;
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

  /** Verified live against the real API (`user.getTopTracks`, `format=json`): every
   * track's `image` array points at the same shared placeholder graphic `TopTrack`'s
   * docstring documents — deliberately not surfaced, same reasoning as
   * `getTopArtists`. */
  async getTopTracks(options: {
    readonly user: string;
    readonly period?: TopTracksPeriod;
    readonly limit?: number;
  }): Promise<TopTrack[]> {
    const params: Record<string, string> = { user: options.user };
    if (options.period !== undefined) {
      params.period = options.period;
    }
    if (options.limit !== undefined) {
      params.limit = String(options.limit);
    }

    const result = await this.request<{
      toptracks: { track: TopTrackJson | readonly TopTrackJson[] };
    }>("user.getTopTracks", params, { httpMethod: "GET", signed: false });

    const raw = result.toptracks.track;
    const items: readonly TopTrackJson[] = Array.isArray(raw) ? raw : [raw];
    return items.map((item) => ({
      name: item.name,
      artist: item.artist.name,
      playCount: Number(item.playcount),
    }));
  }

  /** Verified live against the real API (`user.getTopAlbums`, `format=json`): unlike
   * `getTopTracks`/`getTopArtists`, each album's `image` array points at a genuinely
   * distinct hash per album — see `TopAlbum.imageUrl`'s docstring — so this one *is*
   * surfaced, via the same `pickLargestImageUrl` helper every other real-art field in
   * this client uses. */
  async getTopAlbums(options: {
    readonly user: string;
    readonly period?: TopAlbumsPeriod;
    readonly limit?: number;
  }): Promise<TopAlbum[]> {
    const params: Record<string, string> = { user: options.user };
    if (options.period !== undefined) {
      params.period = options.period;
    }
    if (options.limit !== undefined) {
      params.limit = String(options.limit);
    }

    const result = await this.request<{
      topalbums: { album: TopAlbumJson | readonly TopAlbumJson[] };
    }>("user.getTopAlbums", params, { httpMethod: "GET", signed: false });

    const raw = result.topalbums.album;
    const items: readonly TopAlbumJson[] = Array.isArray(raw) ? raw : [raw];
    return items.map((item) => {
      const imageUrl = pickLargestImageUrl(item.image);
      return {
        name: item.name,
        artist: item.artist.name,
        playCount: Number(item.playcount),
        ...(imageUrl ? { imageUrl } : {}),
      };
    });
  }

  async getFriends(options: { readonly user: string }): Promise<Friend[]> {
    const result = await this.request<{
      friends: { user: FriendJson | readonly FriendJson[] };
    }>("user.getFriends", { user: options.user }, { httpMethod: "GET", signed: false });

    const raw = result.friends.user;
    const items: readonly FriendJson[] = Array.isArray(raw) ? raw : [raw];
    return items.map((item) => {
      const avatarUrl = pickLargestImageUrl(item.image);
      return {
        username: item.name,
        ...(item.realname ? { realName: item.realname } : {}),
        ...(item.country ? { location: item.country } : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
        isSubscriber: item.subscriber === "1",
      };
    });
  }

  /** Fetches a user's profile, including their real avatar photo when they have one
   * set — see `UserProfile.avatarUrl`'s docstring for why this (unlike artist images
   * elsewhere in this client) is trustworthy. */
  async getUserInfo(options: { readonly user: string }): Promise<UserProfile> {
    const result = await this.request<{
      user: {
        name: string;
        realname?: string;
        country?: string;
        subscriber?: string;
        image?: readonly LastfmImageJson[];
        playcount?: string;
        registered?: { unixtime?: string };
      };
    }>("user.getInfo", { user: options.user }, { httpMethod: "GET", signed: false });

    const avatarUrl = pickLargestImageUrl(result.user.image);
    // Defensive Number() + isNaN checks, same as every other numeric field this
    // client parses (see e.g. getArtistInfo's stats.listeners) — playcount/
    // registered.unixtime are always present and numeric on a real account (verified
    // live), but never assumed here.
    const totalScrobbles = Number(result.user.playcount);
    const registeredAt = Number(result.user.registered?.unixtime);
    return {
      username: result.user.name,
      ...(result.user.realname ? { realName: result.user.realname } : {}),
      ...(result.user.country ? { location: result.user.country } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
      isSubscriber: result.user.subscriber === "1",
      ...(result.user.playcount !== undefined && !Number.isNaN(totalScrobbles)
        ? { totalScrobbles }
        : {}),
      ...(result.user.registered?.unixtime !== undefined && !Number.isNaN(registeredAt)
        ? { registeredAt }
        : {}),
    };
  }

  /**
   * Total number of tracks this user has "loved" on Last.fm — verified live against
   * the real API (`user.getLovedTracks`, `format=json`, `limit=1`): the response
   * includes a `lovedtracks["@attr"].total` field alongside the (here, unused) track
   * list itself, e.g. `"700"` for the `RJ` test account. `limit: 1` keeps this call
   * cheap — this method only needs the count, not the actual loved-track list (see
   * `TrackDetail.loved`/`RecentTrack.loved` for per-track loved status elsewhere in
   * this client). Kept as its own call rather than folded into `getUserInfo`:
   * `user.getInfo` doesn't include a loved-tracks count at all (confirmed against its
   * real response shape), so showing it needs a second, independent request either
   * way — call sites that don't need it (most of this client's other consumers) don't
   * pay for it.
   */
  async getLovedTracksCount(options: { readonly user: string }): Promise<number> {
    const result = await this.request<{
      lovedtracks: { "@attr": { total?: string } };
    }>(
      "user.getLovedTracks",
      { user: options.user, limit: "1" },
      { httpMethod: "GET", signed: false },
    );

    const total = Number(result.lovedtracks["@attr"].total);
    return Number.isNaN(total) ? 0 : total;
  }

  /**
   * @param options.username Adds `stats.userplaycount` to the response, surfaced here
   * as `ArtistInfo.userPlayCount` — verified live (see that field's docstring). Public,
   * unsigned endpoint even with a `username` passed — no session key needed, same as
   * every other read method on this client.
   */
  async getArtistInfo(options: {
    readonly artist: string;
    readonly username?: string;
  }): Promise<ArtistInfo> {
    const params: Record<string, string> = { artist: options.artist };
    if (options.username !== undefined) {
      params.username = options.username;
    }

    const result = await this.request<{
      artist: {
        name: string;
        bio?: { summary?: string };
        stats: { listeners: string; playcount: string; userplaycount?: string };
      };
    }>("artist.getInfo", params, { httpMethod: "GET", signed: false });

    return {
      name: result.artist.name,
      ...(result.artist.bio?.summary ? { bioSummary: result.artist.bio.summary } : {}),
      listeners: Number(result.artist.stats.listeners),
      playCount: Number(result.artist.stats.playcount),
      ...(result.artist.stats.userplaycount !== undefined
        ? { userPlayCount: Number(result.artist.stats.userplaycount) }
        : {}),
    };
  }

  /**
   * A real per-artist photo sourced from Last.fm itself, when Last.fm actually has
   * one for `artistName` — `undefined` otherwise, including the common case where
   * `artist.getInfo`'s `image` array is present but every size points to Last.fm's
   * own shared placeholder graphic (see `LASTFM_ARTIST_IMAGE_PLACEHOLDER_HASH`; full
   * writeup in `ArtistInfo`'s docstring in `types.ts`) — that's filtered out here so
   * callers never mistake it for a real photo. Throws on request failure (e.g. the
   * artist genuinely doesn't exist in Last.fm's catalog — error code 6), same
   * convention as every other method on this client; callers that want a graceful
   * "try Last.fm, fall back to another source" flow should catch around this call
   * themselves (see `apps/desktop/src/main/artist-images/wire-artist-image.ts`).
   *
   * Deliberately a separate method from `getArtistInfo` rather than adding `imageUrl`
   * to its `ArtistInfo` return type: that type is used far more broadly than any
   * caller that actually wants a photo, and — per its own docstring — was designed
   * specifically to *not* carry this field, to avoid every consumer of artist bio/
   * stats having to independently remember to filter the placeholder.
   */
  async getArtistImageUrl(artistName: string): Promise<string | undefined> {
    const result = await this.request<{
      artist: { image?: readonly LastfmImageJson[] };
    }>("artist.getInfo", { artist: artistName }, { httpMethod: "GET", signed: false });

    const imageUrl = pickLargestImageUrl(result.artist.image);
    return imageUrl && !imageUrl.includes(LASTFM_ARTIST_IMAGE_PLACEHOLDER_HASH)
      ? imageUrl
      : undefined;
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

  /** Popular community tags for an artist (genre/scene/location, typically) — the
   * "Popular tags" row on a track-detail view. Ordered by tag count, most-used first,
   * same order Last.fm itself returns. */
  async getTopTags(options: { readonly artist: string }): Promise<string[]> {
    const result = await this.request<{
      toptags: { tag: TopTagJson | readonly TopTagJson[] };
    }>("artist.getTopTags", { artist: options.artist }, { httpMethod: "GET", signed: false });

    const raw = result.toptags.tag;
    const items: readonly TopTagJson[] = Array.isArray(raw) ? raw : [raw];
    return items.map((item) => item.name);
  }

  /**
   * @param options.username Adds `userplaycount`/`userloved` to the response, surfaced
   * as `TrackDetail.userPlayCount`/`loved` — same pattern and same live-verified
   * guarantee as `getArtistInfo`'s `username` option.
   */
  async getTrackInfo(options: {
    readonly artist: string;
    readonly track: string;
    readonly username?: string;
  }): Promise<TrackDetail> {
    const params: Record<string, string> = { artist: options.artist, track: options.track };
    if (options.username !== undefined) {
      params.username = options.username;
    }

    const result = await this.request<{
      track: {
        name: string;
        url: string;
        listeners: string;
        playcount: string;
        userplaycount?: string;
        userloved?: string;
        artist: { name: string };
        album?: { title: string; image?: readonly LastfmImageJson[] };
      };
    }>("track.getInfo", params, { httpMethod: "GET", signed: false });

    const track = result.track;
    const imageUrl = pickLargestImageUrl(track.album?.image);

    return {
      artist: track.artist.name,
      track: track.name,
      ...(track.album?.title ? { album: track.album.title } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      listeners: Number(track.listeners),
      playCount: Number(track.playcount),
      ...(track.userplaycount !== undefined ? { userPlayCount: Number(track.userplaycount) } : {}),
      loved: track.userloved === "1",
      url: track.url,
    };
  }
}

interface RecentTrackJson {
  /** `extended=1` (always requested by `getRecentTracks` — see there) reshapes this
   * from the bare `{ "#text": ... }` used everywhere else in this client into an
   * object with `name`; both are read defensively here in case that ever changes. */
  readonly artist: { readonly name?: string; readonly "#text"?: string };
  readonly name: string;
  readonly album?: { readonly "#text": string };
  readonly date?: { readonly uts: string };
  readonly "@attr"?: { readonly nowplaying?: string };
  readonly image?: readonly LastfmImageJson[];
  /** Only present under `extended=1` — `"1"` when the requested user has loved this
   * track, `"0"` otherwise. */
  readonly loved?: string;
}

interface ScrobbleResponseItemJson {
  readonly track: { readonly "#text": string };
  readonly ignoredMessage: { readonly code: string };
}

interface TopArtistJson {
  readonly name: string;
  readonly playcount: string;
}

interface TopTrackJson {
  readonly name: string;
  readonly artist: { readonly name: string };
  readonly playcount: string;
}

interface TopAlbumJson {
  readonly name: string;
  readonly artist: { readonly name: string };
  readonly playcount: string;
  readonly image?: readonly LastfmImageJson[];
}

interface FriendJson {
  readonly name: string;
  readonly realname?: string;
  readonly image?: readonly LastfmImageJson[];
  /** `"0"`/`"1"` in the real API (verified live) — a string, same convention as the
   * auth session response's `subscriber` field this client already parses elsewhere. */
  readonly subscriber?: string;
  /** Freeform self-reported location text — empty string, not omitted, when unset
   * (same convention as every other optional Last.fm user field this client parses). */
  readonly country?: string;
}

interface LastfmImageJson {
  readonly size: string;
  readonly "#text": string;
}

/** Picks the largest non-empty image URL out of a Last.fm `image` array. Last.fm
 * returns an empty `#text` (not a missing entry) for every size when there's no real
 * image to serve, so this has to check for that rather than just taking the first
 * entry — an empty string is still "present". `undefined` if every size is empty, the
 * array is empty, or missing entirely. */
function pickLargestImageUrl(images: readonly LastfmImageJson[] | undefined): string | undefined {
  if (!images) {
    return undefined;
  }
  const bySize = new Map(images.map((image) => [image.size, image["#text"]]));
  for (const size of ["mega", "extralarge", "large", "medium", "small"]) {
    const url = bySize.get(size);
    if (url) {
      return url;
    }
  }
  // Fallback for any size label not in the list above, in case Last.fm ever adds one.
  return images.find((image) => image["#text"])?.["#text"];
}

interface SimilarArtistJson {
  readonly name: string;
  readonly match: string;
}

interface TopTagJson {
  readonly name: string;
}

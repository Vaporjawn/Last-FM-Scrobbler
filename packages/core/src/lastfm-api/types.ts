export interface ScrobbleSubmission {
  readonly artist: string;
  readonly track: string;
  /** Unix seconds — when the track started playing. */
  readonly timestamp: number;
  readonly album?: string;
  readonly albumArtist?: string;
  readonly durationSec?: number;
  readonly trackNumber?: number;
  readonly mbid?: string;
}

export interface NowPlayingSubmission {
  readonly artist: string;
  readonly track: string;
  readonly album?: string;
  readonly albumArtist?: string;
  readonly durationSec?: number;
  readonly trackNumber?: number;
  readonly mbid?: string;
}

export interface LastfmSession {
  readonly username: string;
  readonly sessionKey: string;
  readonly isSubscriber: boolean;
}

export interface ScrobbleResultItem {
  readonly track: string;
  /** 0 when accepted; see isRetryableScrobbleIgnoreCode for the ignore code meanings. */
  readonly ignoredCode: number;
  readonly retryable: boolean;
}

export interface ScrobbleBatchResult {
  readonly accepted: number;
  readonly ignored: number;
  readonly results: readonly ScrobbleResultItem[];
}

export interface TrackRef {
  readonly artist: string;
  readonly track: string;
}

export interface RecentTrack {
  readonly artist: string;
  readonly track: string;
  readonly album?: string;
  readonly nowPlaying: boolean;
  /** Unix seconds. Absent when `nowPlaying` is true — Last.fm doesn't date those. */
  readonly timestamp?: number;
  /** Largest available album/track art Last.fm has on file, if any — unlike artist
   * images (see `ArtistInfo` below), these are real cover art and do come through
   * correctly. Omitted when Last.fm has no artwork for this release. */
  readonly imageUrl?: string;
  /** Whether the user has already "loved" this track on Last.fm — real data from
   * `user.getRecentTracks`'s `extended=1` mode, not a guess. */
  readonly loved: boolean;
}

export interface TopArtist {
  readonly name: string;
  readonly playCount: number;
}

/** `user.getTopArtists`'s own `period` parameter values — Last.fm's API defaults to
 * `"overall"` when omitted entirely (see `LastfmClient.getTopArtists`'s docstring),
 * which is why every existing caller of that method simply never passed one. */
export type TopArtistsPeriod = "overall" | "7day" | "1month" | "3month" | "6month" | "12month";

export interface TopTrack {
  readonly name: string;
  readonly artist: string;
  readonly playCount: number;
  // Deliberately no `imageUrl` here, same reasoning as `TopArtist` above: verified
  // live against the real API (`user.getTopTracks`, `format=json`) that every track's
  // `image` array points at the exact same shared placeholder graphic (hash
  // `2a96cbd8b46e442fc41c2b86b821562f`) `ArtistInfo`'s docstring already documents for
  // artists — not real per-track art. Contrast `TopAlbum.imageUrl` below, which *is*
  // real.
}

/** Same period enum `user.getTopArtists` uses — verified live that `user.getTopTracks`
 * and `user.getTopAlbums` both accept the identical set of values, so this is reused
 * rather than redeclared per entity type. */
export type TopTracksPeriod = TopArtistsPeriod;

export interface TopAlbum {
  readonly name: string;
  readonly artist: string;
  readonly playCount: number;
  /** Unlike `TopTrack.playCount`'s sibling `imageUrl` (deliberately omitted — see
   * there) and `TopArtist`'s (also omitted — see `ArtistInfo`'s docstring), this one
   * *is* real: verified live against `user.getTopAlbums` that each album's `image`
   * array points at a genuinely distinct hash per album (e.g.
   * `7a483359b47821463c1eced172d6bed4` for one album, `d8a6417d7c1d30ed4a211bdceb0e8cf9`
   * for another in the same response) — the same kind of real cover art
   * `RecentTrack.imageUrl`/`TrackDetail.imageUrl` already provide, not the shared
   * artist/track placeholder. `undefined` on the rare album Last.fm has no art for. */
  readonly imageUrl?: string;
}

export type TopAlbumsPeriod = TopArtistsPeriod;

export interface UserProfile {
  readonly username: string;
  readonly realName?: string;
  /** The user's self-reported location — verified live against the real API
   * (`user.getInfo`, `format=json`): the response includes a top-level `"country"`
   * field directly (e.g. `"United Kingdom"` for the `RJ` test account), same raw field
   * Last.fm uses on `user.getFriends` (see `Friend.location`'s docstring — renamed
   * here for the same reason: freeform text a user typed, not necessarily an ISO
   * country name/code). `undefined` when the account hasn't set one. */
  readonly location?: string;
  /** Largest avatar image Last.fm has on file for this user, if any — `undefined`
   * when the account has no photo set (Last.fm returns an empty `#text` for every
   * size in that case). Unlike artist images (see `ArtistInfo` below — Last.fm's
   * `artist.getInfo`/`user.getTopArtists` only ever return the same generic
   * placeholder image for every artist, a known, long-standing limitation of Last.fm's
   * own API, not something fixable client-side), user avatars are real, user-uploaded
   * photos and do come through correctly. */
  readonly avatarUrl?: string;
  /** Whether this account has an active Last.fm Pro subscription — verified live
   * against the real API (`user.getInfo`, `format=json`): the response includes a
   * top-level `"subscriber": "0"/"1"` field directly, same as `Friend.isSubscriber`.
   * Defaults to `false` for the (in practice, never observed) case where a response
   * omits the field. */
  readonly isSubscriber: boolean;
  /** Total scrobbles this account has ever submitted, Last.fm-wide (not just via this
   * app) — verified live against the real API (`user.getInfo`, `format=json`): the
   * response includes a top-level `"playcount"` string field, populated for every
   * real account (e.g. `"151481"` for Last.fm's own public `RJ` test account).
   * `undefined` only if the field is ever absent or non-numeric — not expected in
   * practice, but parsed defensively rather than assumed, same as every other
   * numeric field this client parses. */
  readonly totalScrobbles?: number;
  /** Unix seconds this account was created — verified live against the real API:
   * `user.getInfo`'s response includes a `registered.unixtime` field (e.g.
   * `"1037793040"` for the `RJ` test account, corresponding to November 2002). Kept
   * as a raw timestamp, not a formatted string, so the renderer controls date
   * formatting/locale — same convention as every other timestamp this client returns
   * (e.g. `RecentTrack.timestamp`). `undefined` if the field is ever absent. */
  readonly registeredAt?: number;
}

export interface Friend {
  readonly username: string;
  readonly realName?: string;
  /** The friend's self-reported location, straight off Last.fm's own `user.getFriends`
   * response (raw field name `country` — confirmed live against Last.fm's own API docs
   * at https://www.last.fm/api/show/user.getFriends, e.g. `"country": "UK"`) — renamed
   * to `location` here since that's what it actually represents (freeform text a user
   * typed, not necessarily an ISO country name/code — Last.fm doesn't validate it).
   * `undefined` when the friend hasn't set one, same empty-string-means-absent
   * convention as every other optional field on this type. */
  readonly location?: string;
  /** Same real-photo guarantee as `UserProfile.avatarUrl` (see its docstring) —
   * friends are Last.fm users too, and `user.getFriends` returns each one's own real
   * avatar directly in the same response, no separate per-friend lookup needed. */
  readonly avatarUrl?: string;
  /** Whether this friend has an active Last.fm Pro subscription — verified live
   * against the real API (`user.getfriends`, `format=json`): each user object in the
   * response includes its own top-level `"subscriber": "0"/"1"` field directly, same
   * as `avatarUrl` above, no separate per-friend lookup needed. Defaults to `false`
   * for the (in practice, never observed) case where a response omits the field. */
  readonly isSubscriber: boolean;
}

export interface ArtistInfo {
  readonly name: string;
  readonly bioSummary?: string;
  readonly listeners: number;
  readonly playCount: number;
  /** The *requesting user's* own play count for this artist — only present when
   * `getArtistInfo` was called with a `username` (see that method's docstring).
   * Verified live: `artist.getInfo`'s `stats.userplaycount` is real, personal data —
   * unrelated to (and not affected by) the artist-photo placeholder issue below,
   * which is specifically about the `image` array, not `stats`. */
  readonly userPlayCount?: number;
  // Deliberately no `imageUrl` here (or on `TopArtist`/`SimilarArtist` below): verified
  // live against the real API that `artist.getInfo` and `user.getTopArtists` both
  // return an `image` array, but every size's `#text` points to the exact same generic
  // placeholder graphic (hash `2a96cbd8b46e442fc41c2b86b821562f`) for every artist,
  // regardless of which artist was requested — a known, long-standing issue on
  // Last.fm's side (see e.g. their own API support forum), not something this client
  // can fix. Surfacing that URL would look like a real photo per artist when it's
  // actually the identical image for all of them. Contrast `UserProfile.avatarUrl`
  // above, which comes from `user.getInfo` and *is* a real per-account photo. Real
  // artist photos *are* available, just not from Last.fm — see
  // `packages/core/src/artist-images/fetch-artist-image-url.ts`, which sources them
  // from Deezer's public artist search instead.
}

export interface SimilarArtist {
  readonly name: string;
  readonly match: number;
}

export interface TrackDetail {
  readonly artist: string;
  readonly track: string;
  readonly album?: string;
  /** Real album/track art — same source and same guarantees as `RecentTrack.imageUrl`
   * (this is not subject to the artist-photo placeholder issue; see `ArtistInfo`). */
  readonly imageUrl?: string;
  readonly listeners: number;
  readonly playCount: number;
  /** The requesting user's own play count for this exact track — only present when
   * `getTrackInfo` was called with a `username`. */
  readonly userPlayCount?: number;
  readonly loved: boolean;
  /** The track's own Last.fm page — for a "view on Last.fm" external link. */
  readonly url: string;
}

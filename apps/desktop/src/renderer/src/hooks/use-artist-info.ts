import type { ArtistInfo, SimilarArtist } from "@lastfm-scrobbler/core";
import { useLastfmFetch } from "./use-lastfm-fetch.js";

interface ArtistInfoData {
  readonly info: ArtistInfo | undefined;
  readonly similarArtists: readonly SimilarArtist[];
}

export interface ArtistInfoState extends ArtistInfoData {
  readonly loading: boolean;
  /** True only while a manual `refetch()` is in flight — see
   * `LastfmFetchState.refreshing`'s docstring. */
  readonly refreshing: boolean;
  readonly error: string | undefined;
  /** Re-fetches both `artist.getInfo` and `artist.getSimilar` for the same
   * `artistName`/`username` — see `LastfmFetchState.refetch`'s docstring. */
  readonly refetch: () => void;
}

const EMPTY_DATA: ArtistInfoData = { info: undefined, similarArtists: [] };

/**
 * Fetches `artist.getInfo` + `artist.getSimilar` for `artistName` via `window.lastfm`
 * (see `src/shared/lastfm-api.ts`) — the bio/stats/similar-artists panel under Now
 * Playing and on ScrobbleDetailPage. Both are public, unsigned endpoints, so this works
 * regardless of whether an account is logged in. Returns the inert empty state — never
 * throws — when `artistName` is undefined (nothing playing) or `window.lastfm` isn't
 * present.
 *
 * Both calls are wrapped in one `useLastfmFetch` call (`Promise.all`, resolving a
 * single combined `ArtistInfoData`) rather than two separate ones — they're always
 * needed together for this one panel, and one shared `loading`/`refetch` reads more
 * naturally here than reconciling two independent ones.
 *
 * @param username When given, `info.userPlayCount` is populated with this user's own
 * play count for the artist (see `getArtistInfo`'s docstring) — NowPlayingPage omits
 * this (no natural "which account" to attribute now-playing to), ScrobbleDetailPage
 * passes the active account.
 */
export function useArtistInfo(artistName: string | undefined, username?: string): ArtistInfoState {
  const lastfm = window.lastfm;
  const call =
    artistName && lastfm
      ? (): Promise<ArtistInfoData> =>
          Promise.all([
            lastfm.getArtistInfo(artistName, username),
            lastfm.getSimilarArtists(artistName, 4),
          ]).then(([info, similarArtists]) => ({ info, similarArtists }))
      : undefined;
  const { data, loading, refreshing, error, refetch } = useLastfmFetch(EMPTY_DATA, call, [
    artistName,
    username,
  ]);
  return { ...data, loading, refreshing, error, refetch };
}

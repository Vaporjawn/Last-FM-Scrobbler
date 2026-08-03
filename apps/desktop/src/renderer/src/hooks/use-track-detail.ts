import type { TrackDetail } from "@lastfm-scrobbler/core";
import { useLastfmFetch } from "./use-lastfm-fetch.js";

export interface TrackDetailState {
  /** `undefined` while loading, when `artist`/`track` are undefined (nothing
   * playing), when `window.lastfm` isn't present, or when the lookup fails; callers
   * should treat `undefined` as "show whatever fallback applies" (placeholder
   * artwork, no stats block) — the same decorative-data contract `useArtistImage`
   * uses for artist photos. */
  readonly detail: TrackDetail | undefined;
  readonly refreshing: boolean;
  /** Re-fetches `track.getInfo` for the same `artist`/`track`/`username` — see
   * `LastfmFetchState.refetch`'s docstring. */
  readonly refetch: () => void;
}

const EMPTY_DETAIL: TrackDetail | undefined = undefined;

/**
 * Full track detail (real album art, listener/play stats, the track's own Last.fm
 * URL, and — once logged in — the user's own play count/loved status) for the
 * currently-playing track, via `window.lastfm.getTrackInfo`. `NowPlayingPage` needs
 * its own fetch here because the currently-playing track isn't part of scrobble
 * history (`RecentTrack`) yet. A failed lookup resolves to `EMPTY_DETAIL` rather than
 * surfacing an error anywhere in the UI, same decorative-data contract as before this
 * hook gained a `refetch` — this is still "nothing to show," not something worth an
 * error banner over.
 *
 * @param username When given, the returned `TrackDetail.userPlayCount`/`loved` are
 * populated with this user's own data for the track — same optional-third-parameter
 * convention as `useTrackInfo` (the sibling hook `ScrobbleDetailPage` uses for past
 * scrobbles), forwarded straight through to `getTrackInfo`.
 */
export function useTrackDetail(
  artist: string | undefined,
  track: string | undefined,
  username?: string,
): TrackDetailState {
  const lastfm = window.lastfm;
  const call =
    artist && track && lastfm ? () => lastfm.getTrackInfo(artist, track, username) : undefined;
  const { data, refreshing, refetch } = useLastfmFetch(EMPTY_DETAIL, call, [
    artist,
    track,
    username,
  ]);
  return { detail: data, refreshing, refetch };
}

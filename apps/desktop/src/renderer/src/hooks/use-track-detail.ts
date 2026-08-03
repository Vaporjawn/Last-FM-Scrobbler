import { useEffect, useState } from "react";
import type { TrackDetail } from "@lastfm-scrobbler/core";

/**
 * Full track detail (real album art, listener/play stats, the track's own Last.fm
 * URL, and — once logged in — the user's own play count/loved status) for the
 * currently-playing track, via `window.lastfm.getTrackInfo`. `NowPlayingPage` needs
 * its own fetch here because the currently-playing track isn't part of scrobble
 * history (`RecentTrack`) yet. Returns `undefined` — never throws — while loading,
 * when `artist`/`track` are undefined (nothing playing), when `window.lastfm` isn't
 * present, or when the lookup fails; callers should treat `undefined` as "show
 * whatever fallback applies" (placeholder artwork, no stats block) — the same
 * decorative-data contract `useArtistImage` uses for artist photos.
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
): TrackDetail | undefined {
  const [detail, setDetail] = useState<TrackDetail | undefined>(undefined);

  useEffect(() => {
    if (!artist || !track || !window.lastfm) {
      setDetail(undefined);
      return;
    }
    let cancelled = false;

    window.lastfm
      .getTrackInfo(artist, track, username)
      .then((result) => {
        if (!cancelled) {
          setDetail(result);
        }
      })
      .catch(() => {
        // Decorative data — a failed lookup just means no stats/art/link to show,
        // same as "Last.fm has nothing on file", not an error state anywhere in the UI.
        if (!cancelled) {
          setDetail(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [artist, track, username]);

  return detail;
}

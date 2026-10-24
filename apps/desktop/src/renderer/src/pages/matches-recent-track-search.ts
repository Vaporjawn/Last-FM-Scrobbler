import type { RecentTrack } from "@lastfm-scrobbler/core";

// Matches track title and artist (the two fields ScrobbleListItem itself leads with)
// plus album — searching an album name to find every scrobble from it is a real,
// common use case a plain title/artist match would miss entirely. Same
// case-insensitive substring convention as FriendsPage's own `matchesFriendSearch`.
export function matchesRecentTrackSearch(track: RecentTrack, query: string): boolean {
  return (
    track.track.toLowerCase().includes(query) ||
    track.artist.toLowerCase().includes(query) ||
    (track.album?.toLowerCase().includes(query) ?? false)
  );
}

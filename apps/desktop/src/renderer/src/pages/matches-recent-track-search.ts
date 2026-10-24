import type { RecentTrack } from "@lastfm-scrobbler/core";

// Matches track title and artist (the two fields ScrobbleListItem itself leads with)
// plus album — searching an album name to find every scrobble from it is a real,
// common use case a plain title/artist match would miss entirely. Same
// case-insensitive substring convention as FriendsPage's own `matchesFriendSearch`.
/**
 * Whether a scrobble matches the Scrobbles page search box (see the note above on which
 * fields are searched).
 *
 * @param query Already trimmed and lowercased by the caller; only the track's fields are lowercased here.
 */
export function matchesRecentTrackSearch(track: RecentTrack, query: string): boolean {
  return (
    track.track.toLowerCase().includes(query) ||
    track.artist.toLowerCase().includes(query) ||
    (track.album?.toLowerCase().includes(query) ?? false)
  );
}

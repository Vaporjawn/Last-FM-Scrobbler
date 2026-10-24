import type { Friend } from "@lastfm-scrobbler/core";

export function matchesFriendSearch(friend: Friend, query: string): boolean {
  return (
    friend.username.toLowerCase().includes(query) ||
    (friend.realName?.toLowerCase().includes(query) ?? false)
  );
}

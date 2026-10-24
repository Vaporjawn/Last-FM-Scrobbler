import type { Friend } from "@lastfm-scrobbler/core";

/**
 * Whether a friend matches the Friends page search box: a case-insensitive substring match
 * against their username or, when they have one, their real name.
 *
 * @param query Already trimmed and lowercased by the caller; only the friend's fields are lowercased here.
 */
export function matchesFriendSearch(friend: Friend, query: string): boolean {
  return (
    friend.username.toLowerCase().includes(query) ||
    (friend.realName?.toLowerCase().includes(query) ?? false)
  );
}

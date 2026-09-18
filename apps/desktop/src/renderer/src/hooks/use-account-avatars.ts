import { useEffect, useState } from "react";
import { fetchEachWithLimit } from "./fetch-each-with-limit.js";

export type AccountAvatarMap = Readonly<Record<string, string | undefined>>;

/** Maximum number of `getUserInfo` calls this hook allows in flight at once — same
 * concurrency limit and rationale as `useFriendsActivity`'s `MAX_CONCURRENT_REQUESTS`,
 * applied here for consistency even though this hook is currently only ever called
 * with the small locally-saved-account list (see `SettingsPage`), not a friend list. */
const MAX_CONCURRENT_REQUESTS = 8;

/**
 * Real Last.fm profile-photo URLs for a list of account usernames (e.g. every saved
 * account in Settings → Accounts), via `window.lastfm.getUserInfo` — the same
 * `UserProfile.avatarUrl` field `ProfilePage` already renders for the active account.
 * Fetched independently per username, updating the returned map as each one settles
 * — mirrors `useFriendsActivity`'s reasoning: Last.fm has no bulk "user info for these
 * N users" endpoint, so this fires one request per account, and one account's slow or
 * failed fetch shouldn't block or blank the others. Keyed on a stable joined-usernames
 * string (not the array reference) so this doesn't re-fetch on every unrelated
 * re-render. A username missing from the map, or mapped to `undefined`, means "still
 * loading, failed, or has no photo set" — callers should fall back to a letter avatar
 * in all three cases, same as `ProfilePage` already does for the active account.
 */
export function useAccountAvatars(usernames: readonly string[]): AccountAvatarMap {
  const [avatarsByUsername, setAvatarsByUsername] = useState<Record<string, string | undefined>>({});
  const usernamesKey = usernames.join(" ");

  useEffect(() => {
    if (!window.lastfm || usernames.length === 0) {
      setAvatarsByUsername({});
      return;
    }
    const lastfm = window.lastfm;
    let cancelled = false;

    void fetchEachWithLimit(
      usernames,
      (username) => lastfm.getUserInfo(username),
      MAX_CONCURRENT_REQUESTS,
      (username, result) => {
        if (cancelled) {
          return;
        }
        // Decorative data — a failed lookup falls back to the letter avatar exactly
        // like "no photo found", silently, same contract as useFriendsActivity's
        // per-item fetches and useArtistImage's artist-photo lookups.
        const avatarUrl = result.status === "fulfilled" ? result.value.avatarUrl : undefined;
        setAvatarsByUsername((previous) => ({ ...previous, [username]: avatarUrl }));
      },
    );

    return () => {
      cancelled = true;
    };
  }, [usernamesKey]);

  return avatarsByUsername;
}

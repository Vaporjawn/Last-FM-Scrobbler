import { useEffect, useState } from "react";

export type AccountAvatarMap = Readonly<Record<string, string | undefined>>;

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
    let cancelled = false;

    usernames.forEach((username) => {
      window.lastfm
        ?.getUserInfo(username)
        .then((profile) => {
          if (!cancelled) {
            setAvatarsByUsername((previous) => ({ ...previous, [username]: profile.avatarUrl }));
          }
        })
        .catch(() => {
          // Decorative data — a failed lookup falls back to the letter avatar exactly
          // like "no photo found", silently, same contract as useFriendsActivity's
          // per-item fetches and useArtistImage's artist-photo lookups.
          if (!cancelled) {
            setAvatarsByUsername((previous) => ({ ...previous, [username]: undefined }));
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [usernamesKey]);

  return avatarsByUsername;
}

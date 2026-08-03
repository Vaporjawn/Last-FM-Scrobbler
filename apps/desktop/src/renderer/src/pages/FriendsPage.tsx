import type { JSX } from "react";
import { useMemo, useState } from "react";
import ClearIcon from "@mui/icons-material/Clear";
import PeopleIcon from "@mui/icons-material/People";
import SearchIcon from "@mui/icons-material/Search";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import type { Friend } from "@lastfm-scrobbler/core";
import { AsyncState } from "../components/AsyncState.js";
import { FriendListItem, FRIEND_COLUMN_WIDTH } from "../components/FriendListItem.js";
import { LoginPrompt } from "../components/LoginPrompt.js";
import { PageHeader } from "../components/PageHeader.js";
import { RefreshButton } from "../components/shared/RefreshButton.js";
import { friendActivityOrEmpty } from "../hooks/friend-activity-or-empty.js";
import { useAuth } from "../hooks/use-auth.js";
import { useFriends } from "../hooks/use-friends.js";
import { useFriendsActivity } from "../hooks/use-friends-activity.js";
import type { PageProps } from "./page-props.js";

function matchesSearch(friend: Friend, query: string): boolean {
  return (
    friend.username.toLowerCase().includes(query) ||
    (friend.realName?.toLowerCase().includes(query) ?? false)
  );
}

/**
 * The logged-in account's Last.fm friends list — a search box over real-time "who's
 * scrobbling now" activity (see `useFriendsActivity`), sorted with currently-playing
 * friends first. Each row drills into that friend's own `ProfilePage`
 * (`onSelectFriend`) or their current/last track's `ScrobbleDetailPage`
 * (`onSelectScrobble`) — see `FriendListItem`.
 */
export function FriendsPage({
  onNavigateToSettings,
  onSelectScrobble,
  onSelectFriend,
}: PageProps): JSX.Element {
  const { activeAccount } = useAuth();
  const {
    friends,
    loading,
    refreshing: friendsRefreshing,
    error,
    refetch: refetchFriends,
  } = useFriends(activeAccount);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetched once per friend regardless of the search filter below — search is a pure
  // client-side narrowing of already-loaded data, not something that should re-fire
  // API calls on every keystroke. See useFriendsActivity's docstring for why this
  // lives here (page level) rather than inside each FriendListItem row.
  const { activityByUsername, refetch: refetchActivity } = useFriendsActivity(
    friends.map((friend) => friend.username),
  );
  // One combined refresh for the whole page: the friend list itself and everyone's
  // current activity are two independent fetches (see useFriendsActivity's own
  // docstring for why activity isn't just folded into useFriends), but from the
  // user's point of view "refresh Friends" means both at once.
  const refetchAll = (): void => {
    refetchFriends();
    refetchActivity();
  };

  const visibleFriends = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matching = query ? friends.filter((friend) => matchesSearch(friend, query)) : friends;

    // Friends currently "Scrobbling now" first; everyone else keeps their existing
    // relative order — Array.prototype.sort has been a stable sort since ES2019, so
    // a same-priority comparison of 0 is enough to preserve that rather than needing
    // to re-derive the original order some other way.
    return [...matching].sort((a, b) => {
      const aPlaying =
        friendActivityOrEmpty(activityByUsername, a.username).track?.nowPlaying ?? false;
      const bPlaying =
        friendActivityOrEmpty(activityByUsername, b.username).track?.nowPlaying ?? false;
      if (aPlaying === bPlaying) {
        return 0;
      }
      return aPlaying ? -1 : 1;
    });
  }, [friends, searchQuery, activityByUsername]);

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Friends"
        subtitle={
          !loading && !error && friends.length > 0
            ? `${friends.length} friend${friends.length === 1 ? "" : "s"}`
            : undefined
        }
        inlineSubtitle
        action={
          activeAccount ? (
            <RefreshButton
              onRefresh={refetchAll}
              refreshing={friendsRefreshing}
              label="Refresh friends"
            />
          ) : undefined
        }
      />

      {!activeAccount ? (
        <LoginPrompt
          message="Log in with Last.fm on the Settings page to see your friends' activity."
          onNavigateToSettings={onNavigateToSettings}
        />
      ) : loading ? (
        <AsyncState kind="loading" variant="list" label="Loading friends…" />
      ) : error ? (
        <AsyncState kind="error" message={error} />
      ) : friends.length === 0 ? (
        <AsyncState
          kind="empty"
          icon={<PeopleIcon sx={{ fontSize: 48 }} />}
          message="No friends to show."
        />
      ) : (
        <>
          <TextField
            size="small"
            placeholder="Search friends"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
            sx={{ mb: 1.5, maxWidth: 480 }}
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label="Clear search"
                      onClick={() => {
                        setSearchQuery("");
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />

          {visibleFriends.length === 0 ? (
            <AsyncState
              kind="empty"
              icon={<SearchOffIcon sx={{ fontSize: 48 }} />}
              message={`No friends match "${searchQuery}".`}
            />
          ) : (
            <Paper variant="outlined" sx={{ maxWidth: 480 }}>
              {/* The grid container every FriendListItem row's own Paper subgrids
                  into — see that component's docstring for why this (one shared set
                  of column tracks) is what actually guarantees every row's columns
                  line up, rather than each row's Paper independently computing its
                  own `190px 1fr` and merely intending to agree with its neighbors.
                  `rowGap`/`py` replace the vertical spacing each `ListItem` used to
                  contribute itself via `py: 1` before it became `display: contents`
                  (a transparent pass-through to its own Paper child, required for
                  that Paper to be a *direct* grid item here, which subgrid needs). */}
              <List
                disablePadding
                sx={{
                  display: "grid",
                  // `minmax(0, 1fr)`, not bare `1fr` — a bare `1fr` track is shorthand
                  // for `minmax(auto, 1fr)`, which refuses to shrink below the widest
                  // *unshrinkable* content any row places in it (here, that's each
                  // row's PlaybackStatusChip, deliberately `flexShrink: 0` — see
                  // FriendListItem's own comment on that). `minmax(0, ...)` is what
                  // actually lets the track — and every row's own `noWrap`/ellipsis
                  // handling within it — take over instead of forcing this whole grid
                  // wider than its container at narrow window widths.
                  gridTemplateColumns: `${FRIEND_COLUMN_WIDTH}px minmax(0, 1fr)`,
                  rowGap: 2,
                  py: 1,
                }}
              >
                {visibleFriends.map((friend) => (
                  <FriendListItem
                    key={friend.username}
                    friend={friend}
                    activity={friendActivityOrEmpty(activityByUsername, friend.username)}
                    {...(onSelectScrobble ? { onSelectTrack: onSelectScrobble } : {})}
                    {...(onSelectFriend ? { onSelectFriend } : {})}
                  />
                ))}
              </List>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}

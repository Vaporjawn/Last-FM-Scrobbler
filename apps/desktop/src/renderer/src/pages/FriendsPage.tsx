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
import { FriendListItem } from "../components/FriendListItem.js";
import { LoginPrompt } from "../components/LoginPrompt.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAuth } from "../hooks/use-auth.js";
import { useFriends } from "../hooks/use-friends.js";
import { friendActivityOrEmpty, useFriendsActivity } from "../hooks/use-friends-activity.js";
import type { PageProps } from "./page-props.js";

function matchesSearch(friend: Friend, query: string): boolean {
  return (
    friend.username.toLowerCase().includes(query) ||
    (friend.realName?.toLowerCase().includes(query) ?? false)
  );
}

export function FriendsPage({ onNavigateToSettings }: PageProps): JSX.Element {
  const { activeAccount } = useAuth();
  const { friends, loading, error } = useFriends(activeAccount);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetched once per friend regardless of the search filter below — search is a pure
  // client-side narrowing of already-loaded data, not something that should re-fire
  // API calls on every keystroke. See useFriendsActivity's docstring for why this
  // lives here (page level) rather than inside each FriendListItem row.
  const activityByUsername = useFriendsActivity(friends.map((friend) => friend.username));

  const visibleFriends = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matching = query ? friends.filter((friend) => matchesSearch(friend, query)) : friends;

    // Friends currently "Scrobbling now" first; everyone else keeps their existing
    // relative order — Array.prototype.sort has been a stable sort since ES2019, so
    // a same-priority comparison of 0 is enough to preserve that rather than needing
    // to re-derive the original order some other way.
    return [...matching].sort((a, b) => {
      const aPlaying = friendActivityOrEmpty(activityByUsername, a.username).track?.nowPlaying ?? false;
      const bPlaying = friendActivityOrEmpty(activityByUsername, b.username).track?.nowPlaying ?? false;
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
      />

      {!activeAccount ? (
        <LoginPrompt
          message="Log in with Last.fm on the Settings page to see your friends' activity."
          onNavigateToSettings={onNavigateToSettings}
        />
      ) : loading ? (
        <AsyncState kind="loading" label="Loading friends…" />
      ) : error ? (
        <AsyncState kind="error" message={error} />
      ) : friends.length === 0 ? (
        <AsyncState kind="empty" icon={<PeopleIcon sx={{ fontSize: 48 }} />} message="No friends to show." />
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
              <List disablePadding>
                {visibleFriends.map((friend) => (
                  <FriendListItem
                    key={friend.username}
                    friend={friend}
                    activity={friendActivityOrEmpty(activityByUsername, friend.username)}
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

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import List from "@mui/material/List";
import type { Friend, RecentTrack } from "@lastfm-scrobbler/core";
import type { FriendActivityState } from "../../src/renderer/src/hooks/friend-activity-state.js";
import { FriendListItem } from "../../src/renderer/src/components/FriendListItem.js";

const EMPTY_ACTIVITY: FriendActivityState = { track: undefined, loading: false, error: undefined };

const TRACK: RecentTrack = {
  artist: "Fleece",
  track: "Under the Light",
  nowPlaying: false,
  timestamp: 1_700_000_000,
  loved: false,
};

const PLAYING_ACTIVITY: FriendActivityState = { track: TRACK, loading: false, error: undefined };

function friend(overrides: Partial<Friend>): Friend {
  return { username: "someuser", isSubscriber: false, ...overrides };
}

describe("FriendListItem", () => {
  it("shows the real name when no location is set", () => {
    render(
      <List>
        <FriendListItem friend={friend({ realName: "Real Name" })} activity={EMPTY_ACTIVITY} />
      </List>,
    );

    expect(screen.getByText("Real Name")).toBeInTheDocument();
  });

  it("shows the location when no real name is set", () => {
    render(
      <List>
        <FriendListItem friend={friend({ location: "London, UK" })} activity={EMPTY_ACTIVITY} />
      </List>,
    );

    expect(screen.getByText("London, UK")).toBeInTheDocument();
  });

  it("combines real name and location on one line when both are set", () => {
    render(
      <List>
        <FriendListItem
          friend={friend({ realName: "Real Name", location: "London, UK" })}
          activity={EMPTY_ACTIVITY}
        />
      </List>,
    );

    expect(screen.getByText("Real Name · London, UK")).toBeInTheDocument();
  });

  it("shows no secondary line when neither real name nor location is set", () => {
    render(
      <List>
        <FriendListItem friend={friend({})} activity={EMPTY_ACTIVITY} />
      </List>,
    );

    expect(screen.getByText("someuser")).toBeInTheDocument();
    expect(screen.queryByText("·")).not.toBeInTheDocument();
  });

  it("shows a same-shaped placeholder (not blank space) when the friend has no recent activity", () => {
    // Regression test: this used to render nothing at all for a friend with no
    // `activity.track`, which collapsed that half of the row down to whatever
    // height the friend column alone needed — a list mixing friends with and
    // without activity visibly zig-zagged between two different row heights.
    render(
      <List>
        <FriendListItem friend={friend({})} activity={EMPTY_ACTIVITY} />
      </List>,
    );

    expect(screen.getByText("No recent activity")).toBeInTheDocument();
  });

  it("keeps the 'No recent activity' placeholder on one line, like every other row's text", () => {
    // Every other piece of text in this row (username, real name/location, track
    // title, artist) is `noWrap` — so at the narrow widths the track/activity column
    // has to support (see PlaybackStatusChip's own docstring), it truncates with an
    // ellipsis instead of wrapping onto a second line. This placeholder used to be
    // the one exception: plain multi-line-capable Typography with no `noWrap` and no
    // `minWidth: 0` on its wrapping Box, so at those same narrow widths it could wrap
    // "No recent activity" onto two lines while every activity-having row next to it
    // stayed single-line — reintroducing, for this specific row shape, the exact
    // row-height inconsistency the same-shaped-placeholder fix above exists to
    // prevent. Asserting the real `noWrap` class (not a jsdom-computed layout value —
    // see TopAlbumListItem.test.tsx's docstring for why this project doesn't trust
    // jsdom's flex-layout resolution) is what actually distinguishes "will truncate"
    // from "will wrap".
    render(
      <List>
        <FriendListItem friend={friend({})} activity={EMPTY_ACTIVITY} />
      </List>,
    );

    expect(screen.getByText("No recent activity")).toHaveClass("MuiTypography-noWrap");
  });

  it("is not interactive when onSelectTrack is omitted", () => {
    render(
      <List>
        <FriendListItem friend={friend({})} activity={PLAYING_ACTIVITY} />
      </List>,
    );

    expect(
      screen.queryByRole("button", { name: /view details for under the light/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onSelectTrack with the friend's track when the activity card is clicked", () => {
    const onSelectTrack = vi.fn();
    render(
      <List>
        <FriendListItem
          friend={friend({})}
          activity={PLAYING_ACTIVITY}
          onSelectTrack={onSelectTrack}
        />
      </List>,
    );

    fireEvent.click(screen.getByRole("button", { name: /view details for under the light/i }));

    expect(onSelectTrack).toHaveBeenCalledWith(TRACK);
  });

  describe("playback status", () => {
    it("shows the last-scrobbled timestamp as the shared PlaybackStatusChip", () => {
      render(
        <List>
          <FriendListItem friend={friend({})} activity={PLAYING_ACTIVITY} />
        </List>,
      );

      expect(
        screen.getByText(new Date(1_700_000_000 * 1000).toLocaleString()),
      ).toBeInTheDocument();
    });

    it("shows a 'Scrobbling now' status chip instead of a timestamp while nowPlaying", () => {
      const nowPlayingActivity: FriendActivityState = {
        track: { ...TRACK, nowPlaying: true },
        loading: false,
        error: undefined,
      };
      render(
        <List>
          <FriendListItem friend={friend({})} activity={nowPlayingActivity} />
        </List>,
      );

      expect(screen.getByRole("status", { name: "Scrobbling now" })).toBeInTheDocument();
      expect(
        screen.queryByText(new Date(1_700_000_000 * 1000).toLocaleString()),
      ).not.toBeInTheDocument();
    });
  });

  describe("subscriber badge", () => {
    it("shows the Last.fm Pro badge on the avatar for a subscriber", () => {
      render(
        <List>
          <FriendListItem friend={friend({ isSubscriber: true })} activity={EMPTY_ACTIVITY} />
        </List>,
      );

      expect(screen.getByTitle("Last.fm Pro subscriber")).toBeInTheDocument();
    });

    it("doesn't show the badge for a non-subscriber", () => {
      render(
        <List>
          <FriendListItem friend={friend({ isSubscriber: false })} activity={EMPTY_ACTIVITY} />
        </List>,
      );

      expect(screen.queryByTitle("Last.fm Pro subscriber")).not.toBeInTheDocument();
    });
  });

  describe("onSelectFriend", () => {
    it("is not interactive on the avatar/name row when onSelectFriend is omitted", () => {
      render(
        <List>
          <FriendListItem friend={friend({ username: "bob" })} activity={EMPTY_ACTIVITY} />
        </List>,
      );

      expect(screen.queryByRole("button", { name: /view bob's profile/i })).not.toBeInTheDocument();
    });

    it("calls onSelectFriend with the friend's username when the avatar/name row is clicked", () => {
      const onSelectFriend = vi.fn();
      render(
        <List>
          <FriendListItem
            friend={friend({ username: "bob" })}
            activity={EMPTY_ACTIVITY}
            onSelectFriend={onSelectFriend}
          />
        </List>,
      );

      fireEvent.click(screen.getByRole("button", { name: /view bob's profile/i }));

      expect(onSelectFriend).toHaveBeenCalledWith("bob");
    });

    it("keeps the avatar/name row and the activity card independently clickable", () => {
      const onSelectTrack = vi.fn();
      const onSelectFriend = vi.fn();
      render(
        <List>
          <FriendListItem
            friend={friend({ username: "bob" })}
            activity={PLAYING_ACTIVITY}
            onSelectTrack={onSelectTrack}
            onSelectFriend={onSelectFriend}
          />
        </List>,
      );

      fireEvent.click(screen.getByRole("button", { name: /view details for under the light/i }));
      expect(onSelectTrack).toHaveBeenCalledWith(TRACK);
      expect(onSelectFriend).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: /view bob's profile/i }));
      expect(onSelectFriend).toHaveBeenCalledWith("bob");
    });
  });
});

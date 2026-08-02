import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import List from "@mui/material/List";
import type { RecentTrack } from "@lastfm-scrobbler/core";
import { ScrobbleListItem } from "../../src/renderer/src/components/ScrobbleListItem.js";

const TRACK: RecentTrack = {
  artist: "Crumb",
  track: "Ghostride",
  album: "Jinx",
  nowPlaying: false,
  timestamp: 1_700_000_000,
  loved: false,
};

describe("ScrobbleListItem", () => {
  it("is not interactive when onSelect is omitted", () => {
    render(
      <List>
        <ScrobbleListItem track={TRACK} />
      </List>,
    );

    expect(
      screen.queryByRole("button", { name: /view details for ghostride/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onSelect with the track when the row is clicked", () => {
    const onSelect = vi.fn();
    render(
      <List>
        <ScrobbleListItem track={TRACK} onSelect={onSelect} />
      </List>,
    );

    fireEvent.click(screen.getByRole("button", { name: /view details for ghostride/i }));

    expect(onSelect).toHaveBeenCalledWith(TRACK);
  });

  it("does not call onSelect when clicking the love button", () => {
    const onSelect = vi.fn();
    render(
      <List>
        <ScrobbleListItem track={TRACK} onSelect={onSelect} />
      </List>,
    );

    fireEvent.click(screen.getByRole("button", { name: /love ghostride/i }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not call onSelect when clicking the tag button", () => {
    const onSelect = vi.fn();
    render(
      <List>
        <ScrobbleListItem track={TRACK} onSelect={onSelect} />
      </List>,
    );

    fireEvent.click(screen.getByRole("button", { name: /add tags to ghostride/i }));

    expect(onSelect).not.toHaveBeenCalled();
  });
});

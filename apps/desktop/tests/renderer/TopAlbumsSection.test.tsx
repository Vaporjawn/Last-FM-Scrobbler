import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TopAlbum } from "@lastfm-scrobbler/core";
import { TopAlbumsSection } from "../../src/renderer/src/components/TopAlbumsSection.js";

const ALBUMS: readonly TopAlbum[] = [
  {
    name: "In Rainbows",
    artist: "Radiohead",
    playCount: 120,
    imageUrl: "https://lastfm.freetls.fastly.net/i/u/300x300/inrainbows.jpg",
  },
  { name: "Geogaddi", artist: "Boards of Canada", playCount: 60 },
];

describe("TopAlbumsSection", () => {
  it("shows a loading indicator while loading", () => {
    render(
      <TopAlbumsSection
        title="Top Albums"
        albums={[]}
        loading={true}
        error={undefined}
        viewMode="list"
        onViewModeChange={vi.fn()}
        emptyMessage="No scrobbles yet."
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows the error message on failure", () => {
    render(
      <TopAlbumsSection
        title="Top Albums"
        albums={[]}
        loading={false}
        error="network error"
        viewMode="list"
        onViewModeChange={vi.fn()}
        emptyMessage="No scrobbles yet."
      />,
    );

    expect(screen.getByText("network error")).toBeInTheDocument();
  });

  it("shows the empty message once loaded with no albums", () => {
    render(
      <TopAlbumsSection
        title="Top Albums"
        albums={[]}
        loading={false}
        error={undefined}
        viewMode="list"
        onViewModeChange={vi.fn()}
        emptyMessage="No scrobbles yet."
      />,
    );

    expect(screen.getByText("No scrobbles yet.")).toBeInTheDocument();
  });

  it("renders each album's title, artist, and play count, ranked, in list view", () => {
    render(
      <TopAlbumsSection
        title="Top Albums"
        albums={ALBUMS}
        loading={false}
        error={undefined}
        viewMode="list"
        onViewModeChange={vi.fn()}
        emptyMessage="No scrobbles yet."
      />,
    );

    expect(screen.getByText("In Rainbows")).toBeInTheDocument();
    expect(screen.getByText("Radiohead — 120 plays")).toBeInTheDocument();
    expect(screen.getByText("Geogaddi")).toBeInTheDocument();
    expect(screen.getByText("Boards of Canada — 60 plays")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders tiles instead of list rows when viewMode is 'tiles'", () => {
    render(
      <TopAlbumsSection
        title="Top Albums"
        albums={ALBUMS}
        loading={false}
        error={undefined}
        viewMode="tiles"
        onViewModeChange={vi.fn()}
        emptyMessage="No scrobbles yet."
      />,
    );

    expect(screen.getByText("In Rainbows")).toBeInTheDocument();
    // Rank numbers only exist in the list view's TopAlbumListItem.
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("renders its own title and view-mode Select in one header row, calling onViewModeChange when switched", async () => {
    const onViewModeChange = vi.fn();
    render(
      <TopAlbumsSection
        title="Top Albums"
        albums={ALBUMS}
        loading={false}
        error={undefined}
        viewMode="list"
        onViewModeChange={onViewModeChange}
        emptyMessage="No scrobbles yet."
      />,
    );

    // "Top Albums" appears exactly once — as this component's own header, not
    // duplicated by any external caller-rendered heading (see ProfilePage's
    // docstring on why the Select lives here rather than in a separate row above it).
    expect(screen.getAllByText("Top Albums")).toHaveLength(1);

    fireEvent.mouseDown(screen.getByLabelText("Top Albums view"));
    fireEvent.click(await screen.findByRole("option", { name: "Tiles" }));

    expect(onViewModeChange).toHaveBeenCalledWith("tiles");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TopAlbum } from "@lastfm-scrobbler/core";
import { TopAlbumTile } from "../../src/renderer/src/components/TopAlbumTile.js";

const ALBUM: TopAlbum = {
  name: "In Rainbows",
  artist: "Radiohead",
  playCount: 120,
  imageUrl: "https://lastfm.freetls.fastly.net/i/u/300x300/inrainbows.jpg",
};

/** `TopAlbum`'s `imageUrl` is optional under `exactOptionalPropertyTypes` — omitted
 * entirely, not explicitly set to `undefined`, same conditional-spread-free approach
 * `LastfmClient` itself uses for every optional field it parses. */
const ALBUM_WITHOUT_ART: TopAlbum = { name: "No Art", artist: "Someone", playCount: 5 };

describe("TopAlbumTile", () => {
  it("shows the album name and pluralized play count", () => {
    render(<TopAlbumTile album={ALBUM} />);

    expect(screen.getByText("In Rainbows")).toBeInTheDocument();
    expect(screen.getByText("120 plays")).toBeInTheDocument();
  });

  it("doesn't pluralize a single play", () => {
    render(<TopAlbumTile album={{ ...ALBUM, playCount: 1 }} />);

    expect(screen.getByText("1 play")).toBeInTheDocument();
  });

  it("renders the real artwork as an <img>, not the fallback icon, when art is present", () => {
    render(<TopAlbumTile album={ALBUM} />);

    expect(screen.getByRole("img", { name: "In Rainbows" })).toHaveAttribute("src", ALBUM.imageUrl);
    expect(screen.queryByTestId("AlbumIcon")).not.toBeInTheDocument();
  });

  it("falls back to a plain album icon when no art is on file", () => {
    render(<TopAlbumTile album={ALBUM_WITHOUT_ART} />);

    expect(screen.getByTestId("AlbumIcon")).toBeInTheDocument();
  });

  it("falls back to the album icon when the real artwork URL fails to load", () => {
    // Regression test: ArtworkTile (which this renders through) used to have no
    // onError handler on its <img> at all, unlike every other real-photo component in
    // this app (ArtistAvatar, TrackArtworkAvatar, SubscriberAvatar) — a 404'd/failed
    // network-sourced art URL showed the browser's native broken-image icon instead
    // of the intended fallback, contradicting this component's own "never fails, just
    // shows less" contract.
    render(<TopAlbumTile album={ALBUM} />);
    const img = screen.getByRole("img", { name: "In Rainbows" });

    fireEvent.error(img);

    expect(screen.queryByRole("img", { name: "In Rainbows" })).not.toBeInTheDocument();
    expect(screen.getByTestId("AlbumIcon")).toBeInTheDocument();
  });
});

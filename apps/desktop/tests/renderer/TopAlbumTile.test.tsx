import { render, screen } from "@testing-library/react";
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

  it("doesn't show the fallback album icon when real art is present", () => {
    render(<TopAlbumTile album={ALBUM} />);

    // `sx`-driven background-image styling isn't inspectable via jsdom's computed
    // `style` (MUI/emotion generates a class, not an inline style) — the fallback
    // icon's absence is the reliable, DOM-visible signal that the real-art branch
    // rendered instead of the fallback one, same convention `TopArtistTile`'s own
    // tests use for its equivalent branch.
    expect(screen.queryByTestId("AlbumIcon")).not.toBeInTheDocument();
  });

  it("falls back to a plain album icon when no art is on file", () => {
    render(<TopAlbumTile album={ALBUM_WITHOUT_ART} />);

    expect(screen.getByTestId("AlbumIcon")).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import List from "@mui/material/List";
import type { TopArtist } from "@lastfm-scrobbler/core";
import type { ArtistImageApi } from "../../src/shared/artist-image-api.js";
import { TopArtistListItem } from "../../src/renderer/src/components/TopArtistListItem.js";

const ARTIST: TopArtist = {
  name: "Boards of Canada",
  playCount: 60,
};

function installFakeArtistImageApi(): void {
  const api: ArtistImageApi = { getUrl: vi.fn().mockResolvedValue(undefined) };
  Object.defineProperty(window, "artistImage", { value: api, configurable: true });
}

// See TopAlbumListItem.test.tsx's own top-of-file note for why this deliberately
// doesn't attempt to assert computed min-width/flex-shrink via jsdom.
describe("TopArtistListItem", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "artistImage");
  });

  it("renders the artist name and play count", () => {
    installFakeArtistImageApi();

    render(
      <List>
        <TopArtistListItem artist={ARTIST} rank={1} maxPlayCount={100} />
      </List>,
    );

    expect(screen.getByText("Boards of Canada")).toBeInTheDocument();
    expect(screen.getByText("60 plays")).toBeInTheDocument();
  });

  it("renders the rank number", () => {
    installFakeArtistImageApi();

    render(
      <List>
        <TopArtistListItem artist={ARTIST} rank={4} maxPlayCount={100} />
      </List>,
    );

    expect(screen.getByText("4")).toBeInTheDocument();
  });
});

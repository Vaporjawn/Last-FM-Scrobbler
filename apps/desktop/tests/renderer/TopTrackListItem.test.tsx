import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import List from "@mui/material/List";
import type { TopTrack } from "@lastfm-scrobbler/core";
import type { ArtistImageApi } from "../../src/shared/artist-image-api.js";
import { TopTrackListItem } from "../../src/renderer/src/components/TopTrackListItem.js";

const TRACK: TopTrack = {
  name: "Windowlicker",
  artist: "Aphex Twin",
  playCount: 17,
};

function installFakeArtistImageApi(): void {
  const api: ArtistImageApi = { getUrl: vi.fn().mockResolvedValue(undefined) };
  Object.defineProperty(window, "artistImage", { value: api, configurable: true });
}

// See TopAlbumListItem.test.tsx's own top-of-file note for why this deliberately
// doesn't attempt to assert computed min-width/flex-shrink via jsdom.
describe("TopTrackListItem", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "artistImage");
  });

  it("renders the track name, artist, and play count", () => {
    installFakeArtistImageApi();

    render(
      <List>
        <TopTrackListItem track={TRACK} rank={1} maxPlayCount={100} />
      </List>,
    );

    expect(screen.getByText("Windowlicker")).toBeInTheDocument();
    expect(screen.getByText("Aphex Twin — 17 plays")).toBeInTheDocument();
  });

  it("uses singular 'play' for a play count of exactly 1", () => {
    installFakeArtistImageApi();

    render(
      <List>
        <TopTrackListItem track={{ ...TRACK, playCount: 1 }} rank={1} maxPlayCount={100} />
      </List>,
    );

    expect(screen.getByText("Aphex Twin — 1 play")).toBeInTheDocument();
  });

  it("renders the rank number", () => {
    installFakeArtistImageApi();

    render(
      <List>
        <TopTrackListItem track={TRACK} rank={2} maxPlayCount={100} />
      </List>,
    );

    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

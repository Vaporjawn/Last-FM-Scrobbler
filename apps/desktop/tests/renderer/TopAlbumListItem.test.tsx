import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import List from "@mui/material/List";
import type { TopAlbum } from "@lastfm-scrobbler/core";
import { TopAlbumListItem } from "../../src/renderer/src/components/TopAlbumListItem.js";

const ALBUM: TopAlbum = {
  name: "Kid A",
  artist: "Radiohead",
  playCount: 42,
  imageUrl: "https://example.com/kid-a.jpg",
};

// Note: this deliberately does NOT attempt to assert computed `min-width`/`flex-shrink`
// values via jsdom's `getComputedStyle` — verified empirically (probed directly against
// this project's jsdom/emotion setup) that jsdom's CSSOM does not correctly resolve
// either property for a flex item regardless of what CSS is actually applied, so such an
// assertion would pass identically whether the real fix (`minWidth: 0` on ListItemText,
// `flexShrink` on TrackArtworkAvatar — see this component's source for the full
// reasoning) is present or not, providing false confidence rather than real coverage.
// The narrow-width overlap bug class this guards against was originally found and
// verified via live Playwright screenshots earlier in this project's history for
// exactly this reason — jsdom has no real layout engine to reproduce it against.
describe("TopAlbumListItem", () => {
  it("renders the album name, artist, and play count", () => {
    render(
      <List>
        <TopAlbumListItem album={ALBUM} rank={1} maxPlayCount={100} />
      </List>,
    );

    expect(screen.getByText("Kid A")).toBeInTheDocument();
    expect(screen.getByText("Radiohead — 42 plays")).toBeInTheDocument();
  });

  it("uses singular 'play' for a play count of exactly 1", () => {
    render(
      <List>
        <TopAlbumListItem album={{ ...ALBUM, playCount: 1 }} rank={1} maxPlayCount={100} />
      </List>,
    );

    expect(screen.getByText("Radiohead — 1 play")).toBeInTheDocument();
  });

  it("renders the rank number", () => {
    render(
      <List>
        <TopAlbumListItem album={ALBUM} rank={3} maxPlayCount={100} />
      </List>,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders the album's own artwork via its imageUrl", () => {
    render(
      <List>
        <TopAlbumListItem album={ALBUM} rank={1} maxPlayCount={100} />
      </List>,
    );

    expect(screen.getByAltText("Kid A")).toHaveAttribute("src", ALBUM.imageUrl);
  });
});

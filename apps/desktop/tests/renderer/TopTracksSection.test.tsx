import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TopTrack } from "@lastfm-scrobbler/core";
import type { ArtistImageApi } from "../../src/shared/artist-image-api.js";
import { TopTracksSection } from "../../src/renderer/src/components/TopTracksSection.js";

const TRACKS: readonly TopTrack[] = [
  { name: "Windowlicker", artist: "Aphex Twin", playCount: 120 },
  { name: "Roygbiv", artist: "Boards of Canada", playCount: 60 },
];

/** `TopTrackListItem` renders an `ArtistAvatar` (see its own docstring for why —
 * there's no real per-track art) which fetches via `window.artistImage`, same
 * dependency `TopArtistsSection`'s own tests fake out. */
function installFakeArtistImageApi(): void {
  const api: ArtistImageApi = { getUrl: vi.fn().mockResolvedValue(undefined) };
  Object.defineProperty(window, "artistImage", { value: api, configurable: true });
}

describe("TopTracksSection", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "artistImage");
  });

  it("shows a loading indicator while loading", () => {
    render(
      <TopTracksSection
        title="Top Tracks"
        tracks={[]}
        loading={true}
        error={undefined}
        emptyMessage="No scrobbles yet."
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows the error message on failure", () => {
    render(
      <TopTracksSection
        title="Top Tracks"
        tracks={[]}
        loading={false}
        error="network error"
        emptyMessage="No scrobbles yet."
      />,
    );

    expect(screen.getByText("network error")).toBeInTheDocument();
  });

  it("shows the empty message once loaded with no tracks", () => {
    render(
      <TopTracksSection
        title="Top Tracks"
        tracks={[]}
        loading={false}
        error={undefined}
        emptyMessage="No scrobbles yet."
      />,
    );

    expect(screen.getByText("No scrobbles yet.")).toBeInTheDocument();
  });

  it("renders each track's title, artist, and play count, ranked", async () => {
    installFakeArtistImageApi();

    render(
      <TopTracksSection
        title="Top Tracks"
        tracks={TRACKS}
        loading={false}
        error={undefined}
        emptyMessage="No scrobbles yet."
      />,
    );

    expect(await screen.findByText("Windowlicker")).toBeInTheDocument();
    expect(screen.getByText("Aphex Twin — 120 plays")).toBeInTheDocument();
    expect(screen.getByText("Roygbiv")).toBeInTheDocument();
    expect(screen.getByText("Boards of Canada — 60 plays")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

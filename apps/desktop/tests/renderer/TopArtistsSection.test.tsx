import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TopArtist } from "@lastfm-scrobbler/core";
import type { ArtistImageApi } from "../../src/shared/artist-image-api.js";
import { TopArtistsSection } from "../../src/renderer/src/components/TopArtistsSection.js";

const ARTISTS: readonly TopArtist[] = [
  { name: "Aphex Twin", playCount: 120 },
  { name: "Boards of Canada", playCount: 60 },
];

function installFakeArtistImageApi(): void {
  const api: ArtistImageApi = { getUrl: vi.fn().mockResolvedValue(undefined) };
  Object.defineProperty(window, "artistImage", { value: api, configurable: true });
}

describe("TopArtistsSection", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "artistImage");
  });

  it("shows a loading indicator while loading", () => {
    render(
      <TopArtistsSection
        title="Top Artists This Week"
        artists={[]}
        loading={true}
        error={undefined}
        viewMode="list"
        emptyMessage="No scrobbles this week."
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows the error message on failure", () => {
    render(
      <TopArtistsSection
        title="Top Artists This Week"
        artists={[]}
        loading={false}
        error="network error"
        viewMode="list"
        emptyMessage="No scrobbles this week."
      />,
    );

    expect(screen.getByText("network error")).toBeInTheDocument();
  });

  it("shows the section-specific empty message once loaded with no artists", () => {
    render(
      <TopArtistsSection
        title="Top Artists This Week"
        artists={[]}
        loading={false}
        error={undefined}
        viewMode="list"
        emptyMessage="No scrobbles this week."
      />,
    );

    expect(screen.getByText("No scrobbles this week.")).toBeInTheDocument();
  });

  it("renders list rows scaled against this section's own highest play count", () => {
    render(
      <TopArtistsSection
        title="Top Artists This Week"
        artists={ARTISTS}
        loading={false}
        error={undefined}
        viewMode="list"
        emptyMessage="No scrobbles this week."
      />,
    );

    expect(screen.getByText("Aphex Twin")).toBeInTheDocument();
    expect(screen.getByText("Boards of Canada")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders tiles instead of list rows when viewMode is 'tiles'", async () => {
    installFakeArtistImageApi();

    render(
      <TopArtistsSection
        title="Top Artists This Week"
        artists={ARTISTS}
        loading={false}
        error={undefined}
        viewMode="tiles"
        emptyMessage="No scrobbles this week."
      />,
    );

    expect(await screen.findByText("Aphex Twin")).toBeInTheDocument();
    // Rank numbers only exist in the list view's TopArtistListItem.
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });
});

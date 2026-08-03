import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TopArtist } from "@lastfm-scrobbler/core";
import type { ArtistImageApi } from "../../src/shared/artist-image-api.js";
import { TopArtistTile } from "../../src/renderer/src/components/TopArtistTile.js";

const ARTIST: TopArtist = { name: "Radiohead", playCount: 120 };

function installFakeArtistImageApi(getUrl: ArtistImageApi["getUrl"]): void {
  const api: ArtistImageApi = { getUrl };
  Object.defineProperty(window, "artistImage", { value: api, configurable: true });
}

describe("TopArtistTile", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "artistImage");
  });

  it("shows the artist name and pluralized play count", async () => {
    installFakeArtistImageApi(vi.fn().mockResolvedValue(undefined));

    render(<TopArtistTile artist={ARTIST} />);

    expect(await screen.findByText("Radiohead")).toBeInTheDocument();
    expect(screen.getByText("120 plays")).toBeInTheDocument();
  });

  it("doesn't pluralize a single play", () => {
    installFakeArtistImageApi(vi.fn().mockResolvedValue(undefined));

    render(<TopArtistTile artist={{ name: "Radiohead", playCount: 1 }} />);

    expect(screen.getByText("1 play")).toBeInTheDocument();
  });

  it("falls back to the artist's initial when no real photo is found", async () => {
    installFakeArtistImageApi(vi.fn().mockResolvedValue(undefined));

    render(<TopArtistTile artist={ARTIST} />);

    expect(await screen.findByText("R")).toBeInTheDocument();
  });

  it("renders the real photo as an <img>, not the initial fallback, once found", async () => {
    const imageUrl = "https://e-cdn-images.dzcdn.net/images/artist/radiohead.jpg";
    installFakeArtistImageApi(vi.fn().mockResolvedValue(imageUrl));

    render(<TopArtistTile artist={ARTIST} />);

    expect(await screen.findByRole("img", { name: "Radiohead" })).toHaveAttribute("src", imageUrl);
    expect(screen.queryByText("R")).not.toBeInTheDocument();
  });

  it("falls back to the artist's initial when the real photo URL fails to load", async () => {
    // Regression test, same root cause as TopAlbumTile's — see that test file's own
    // comment for the full reasoning.
    const imageUrl = "https://e-cdn-images.dzcdn.net/images/artist/radiohead.jpg";
    installFakeArtistImageApi(vi.fn().mockResolvedValue(imageUrl));

    render(<TopArtistTile artist={ARTIST} />);
    const img = await screen.findByRole("img", { name: "Radiohead" });

    fireEvent.error(img);

    expect(screen.queryByRole("img", { name: "Radiohead" })).not.toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
  });
});

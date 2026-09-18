import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArtistImageApi } from "../../src/shared/artist-image-api.js";
import { ArtistInfoPanel } from "../../src/renderer/src/components/ArtistInfoPanel.js";

function installFakeArtistImageApi(): void {
  const api: ArtistImageApi = { getUrl: vi.fn().mockResolvedValue(undefined) };
  Object.defineProperty(window, "artistImage", { value: api, configurable: true });
}

describe("ArtistInfoPanel", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "artistImage");
  });

  it("links each similar artist thumbnail to that artist's Last.fm page", () => {
    installFakeArtistImageApi();

    render(
      <ArtistInfoPanel
        artistName="Radiohead"
        info={{ name: "Radiohead", bioSummary: "A band.", listeners: 100, playCount: 200 }}
        similarArtists={[{ name: "Thom Yorke", match: 0.9 }]}
        loading={false}
        error={undefined}
      />,
    );

    const link = screen.getByRole("link", { name: "View Thom Yorke on Last.fm" });
    expect(link).toHaveAttribute("href", "https://www.last.fm/music/Thom%20Yorke");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("wires onRetry into AsyncState's error branch", () => {
    installFakeArtistImageApi();
    const onRetry = vi.fn();
    render(
      <ArtistInfoPanel
        artistName="Radiohead"
        info={undefined}
        similarArtists={[]}
        loading={false}
        error="Can't reach Last.fm — check your internet connection."
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});

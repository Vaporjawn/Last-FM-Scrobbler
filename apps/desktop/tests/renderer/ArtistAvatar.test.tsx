import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArtistImageApi } from "../../src/shared/artist-image-api.js";
import { ArtistAvatar } from "../../src/renderer/src/components/ArtistAvatar.js";

function installFakeArtistImageApi(getUrl: ArtistImageApi["getUrl"]): void {
  const api: ArtistImageApi = { getUrl };
  Object.defineProperty(window, "artistImage", { value: api, configurable: true });
}

describe("ArtistAvatar", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "artistImage");
  });

  it("shows the artist's initial when window.artistImage is absent", async () => {
    render(<ArtistAvatar name="Radiohead" />);

    expect(await screen.findByText("R")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows the artist's initial when no real photo is found", async () => {
    installFakeArtistImageApi(vi.fn().mockResolvedValue(undefined));

    render(<ArtistAvatar name="Radiohead" />);

    expect(await screen.findByText("R")).toBeInTheDocument();
  });

  it("shows the real photo once fetched", async () => {
    installFakeArtistImageApi(vi.fn().mockResolvedValue("https://cdn-images.dzcdn.net/radiohead.jpg"));

    render(<ArtistAvatar name="Radiohead" />);

    const img = await screen.findByRole("img", { name: "Radiohead" });
    expect(img).toHaveAttribute("src", "https://cdn-images.dzcdn.net/radiohead.jpg");
  });

  it("looks up each artist name independently", async () => {
    const getUrl = vi.fn().mockResolvedValue(undefined);
    installFakeArtistImageApi(getUrl);

    render(<ArtistAvatar name="Thom Yorke" />);

    await screen.findByText("T");
    expect(getUrl).toHaveBeenCalledWith("Thom Yorke");
  });
});

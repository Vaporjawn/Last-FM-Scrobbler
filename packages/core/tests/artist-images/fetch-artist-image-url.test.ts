import { describe, expect, it, vi } from "vitest";
import { fetchArtistImageUrl } from "../../src/artist-images/fetch-artist-image-url.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchArtistImageUrl", () => {
  it("returns the largest available picture for a real match", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            name: "Radiohead",
            picture_medium: "https://cdn-images.dzcdn.net/images/artist/abc/250x250.jpg",
            picture_big: "https://cdn-images.dzcdn.net/images/artist/abc/500x500.jpg",
            picture_xl: "https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg",
          },
        ],
      }),
    );

    const result = await fetchArtistImageUrl("Radiohead", fetchMock);

    expect(result).toBe("https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(new URL(url).searchParams.get("q")).toBe("Radiohead");
  });

  it("falls back to picture_big then picture_medium when larger sizes are absent", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({ data: [{ name: "X", picture_medium: "https://example.com/medium.jpg" }] }),
    );

    expect(await fetchArtistImageUrl("X", fetchMock)).toBe("https://example.com/medium.jpg");
  });

  it("returns undefined when Deezer has no match", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ data: [] }));

    expect(await fetchArtistImageUrl("zzznonexistent", fetchMock)).toBeUndefined();
  });

  it("treats Deezer's own 'no photo' placeholder hash as no image", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            name: "DJ",
            picture_xl:
              "https://cdn-images.dzcdn.net/images/artist/d41d8cd98f00b204e9800998ecf8427e/1000x1000-000000-80-0-0.jpg",
          },
        ],
      }),
    );

    expect(await fetchArtistImageUrl("DJ", fetchMock)).toBeUndefined();
  });

  it("returns undefined (rather than throwing) on a non-2xx response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({}, 500));

    expect(await fetchArtistImageUrl("Radiohead", fetchMock)).toBeUndefined();
  });

  it("returns undefined (rather than throwing) when the request itself fails", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("network down"));

    expect(await fetchArtistImageUrl("Radiohead", fetchMock)).toBeUndefined();
  });

  it("defaults to the global fetch when no fetchImpl is given", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ data: [] }));
    globalThis.fetch = fetchMock;

    try {
      await fetchArtistImageUrl("Radiohead");
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

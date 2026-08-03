import { describe, expect, it, vi } from "vitest";

const ipcMainHandlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
const ipcMain = {
  handle: vi.fn((channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
    ipcMainHandlers.set(channel, handler);
  }),
  removeHandler: vi.fn((channel: string) => {
    ipcMainHandlers.delete(channel);
  }),
};

vi.mock("electron", () => ({ ipcMain, default: { ipcMain } }));

const { wireArtistImage } = await import("../../../src/main/artist-images/wire-artist-image.js");
const { IPC_CHANNELS } = await import("../../../src/shared/ipc-channels.js");

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = ipcMainHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return Promise.resolve(handler({}, ...args));
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("wireArtistImage", () => {
  it("resolves with the fetched artist's image URL", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ data: [{ name: "Radiohead", picture_xl: "https://example.com/radiohead.jpg" }] }),
      );
    wireArtistImage({ fetchImpl });

    const result = await invoke(IPC_CHANNELS.artistImageGetUrl, "Radiohead");

    expect(result).toBe("https://example.com/radiohead.jpg");
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(new URL(url).searchParams.get("q")).toBe("Radiohead");
  });

  it("resolves undefined rather than rejecting when nothing is found", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: [] }));
    wireArtistImage({ fetchImpl });

    await expect(invoke(IPC_CHANNELS.artistImageGetUrl, "zzznonexistent")).resolves.toBeUndefined();
  });

  it("removes the handler when the returned cleanup function is called", () => {
    const stop = wireArtistImage({ fetchImpl: vi.fn() });
    expect(ipcMainHandlers.has(IPC_CHANNELS.artistImageGetUrl)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.artistImageGetUrl)).toBe(false);
  });

  describe("Last.fm-first, Deezer-fallback", () => {
    it("tries Last.fm first and returns its photo without ever calling Deezer", async () => {
      const getArtistImageUrl = vi.fn().mockResolvedValue("https://lastfm.example.com/real.jpg");
      const fetchImpl = vi.fn<typeof fetch>();
      wireArtistImage({ lastfmClient: { getArtistImageUrl }, fetchImpl });

      const result = await invoke(IPC_CHANNELS.artistImageGetUrl, "Radiohead");

      expect(result).toBe("https://lastfm.example.com/real.jpg");
      expect(getArtistImageUrl).toHaveBeenCalledWith("Radiohead");
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("falls through to Deezer when Last.fm has nothing for this artist", async () => {
      const getArtistImageUrl = vi.fn().mockResolvedValue(undefined);
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ data: [{ name: "Kendrick Lamar", picture_xl: "https://deezer.example.com/real.jpg" }] }),
        );
      wireArtistImage({ lastfmClient: { getArtistImageUrl }, fetchImpl });

      const result = await invoke(IPC_CHANNELS.artistImageGetUrl, "Kendrick Lamar");

      expect(result).toBe("https://deezer.example.com/real.jpg");
    });

    it("falls through to Deezer when the Last.fm request itself throws", async () => {
      // e.g. LastfmApiError for an artist Last.fm's catalog doesn't have at all —
      // a common, expected case, not something that should ever surface as a failure.
      const getArtistImageUrl = vi.fn().mockRejectedValue(new Error("artist not found"));
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ data: [{ name: "Some Obscure Artist", picture_xl: "https://deezer.example.com/real.jpg" }] }),
        );
      wireArtistImage({ lastfmClient: { getArtistImageUrl }, fetchImpl });

      const result = await invoke(IPC_CHANNELS.artistImageGetUrl, "Some Obscure Artist");

      expect(result).toBe("https://deezer.example.com/real.jpg");
    });

    it("goes straight to Deezer when no lastfmClient is given at all", async () => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ data: [{ name: "Radiohead", picture_xl: "https://deezer.example.com/real.jpg" }] }),
        );
      wireArtistImage({ fetchImpl });

      const result = await invoke(IPC_CHANNELS.artistImageGetUrl, "Radiohead");

      expect(result).toBe("https://deezer.example.com/real.jpg");
    });
  });
});

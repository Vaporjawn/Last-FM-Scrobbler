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
});

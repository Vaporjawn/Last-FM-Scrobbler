import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useArtistImage } from "../../src/renderer/src/hooks/use-artist-image.js";

function installArtistImage(getUrl: (name: string) => Promise<string | undefined>): void {
  Object.defineProperty(window, "artistImage", { value: { getUrl }, configurable: true });
}

describe("useArtistImage", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "artistImage");
  });

  it("is undefined without an artist name or outside a real Electron renderer", () => {
    const { result } = renderHook(() => useArtistImage(undefined));
    expect(result.current).toBeUndefined();

    const outside = renderHook(() => useArtistImage("Radiohead"));
    expect(outside.result.current).toBeUndefined();
  });

  it("returns the photo URL once it resolves, and clears it when the artist goes away", async () => {
    installArtistImage((name) => Promise.resolve(`https://img/${name}.jpg`));

    const { result, rerender } = renderHook<string | undefined, { name: string | undefined }>(
      ({ name }) => useArtistImage(name),
      { initialProps: { name: "Radiohead" } },
    );
    await waitFor(() => {
      expect(result.current).toBe("https://img/Radiohead.jpg");
    });

    rerender({ name: undefined });
    await waitFor(() => {
      expect(result.current).toBeUndefined();
    });
  });

  it("falls back to no photo when the lookup fails", async () => {
    const getUrl = vi.fn(() => Promise.reject(new Error("offline")));
    installArtistImage(getUrl);

    const { result } = renderHook(() => useArtistImage("Radiohead"));

    await waitFor(() => {
      expect(getUrl).toHaveBeenCalled();
    });
    expect(result.current).toBeUndefined();
  });

  it("ignores lookups that settle after the artist changed or the hook unmounted", async () => {
    let resolveFirst: (url: string) => void = () => undefined;
    let rejectSecond: (error: Error) => void = () => undefined;
    const getUrl = vi
      .fn<(name: string) => Promise<string | undefined>>()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectSecond = reject)));
    installArtistImage(getUrl);

    const { result, rerender, unmount } = renderHook(({ name }) => useArtistImage(name), {
      initialProps: { name: "A" },
    });
    rerender({ name: "B" });
    resolveFirst("https://img/stale.jpg");
    await Promise.resolve();
    expect(result.current).toBeUndefined();

    unmount();
    rejectSecond(new Error("late"));
    await Promise.resolve();
    expect(result.current).toBeUndefined();
  });
});

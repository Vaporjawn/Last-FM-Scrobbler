import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTrackInfo } from "../../src/renderer/src/hooks/use-track-info.js";

describe("useTrackInfo", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "lastfm");
  });

  it("does not look anything up without an artist and track, or outside a real renderer", () => {
    const getTrackInfo = vi.fn();
    Object.defineProperty(window, "lastfm", { value: { getTrackInfo }, configurable: true });

    const missing = renderHook(() => useTrackInfo(undefined, "Nude"));
    expect(missing.result.current.loading).toBe(false);
    expect(getTrackInfo).not.toHaveBeenCalled();

    Reflect.deleteProperty(window, "lastfm");
    const outside = renderHook(() => useTrackInfo("Radiohead", "Nude"));
    expect(outside.result.current.loading).toBe(false);
  });
});

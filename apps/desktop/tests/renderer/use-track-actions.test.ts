import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTrackActions } from "../../src/renderer/src/hooks/use-track-actions.js";

function installLastfm(overrides: Record<string, unknown>): void {
  Object.defineProperty(window, "lastfm", { value: overrides, configurable: true });
}

describe("useTrackActions", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "lastfm");
  });

  it("refuses to add tags when nothing is playing or the tag list is empty", async () => {
    const addTags = vi.fn();
    installLastfm({ addTags });
    const { result } = renderHook(() => useTrackActions("Radiohead", "Nude"));

    let empty: unknown;
    await act(async () => {
      empty = await result.current.addTags([]);
    });
    expect(empty).toEqual({ success: false, error: "Nothing is playing right now." });

    const idle = renderHook(() => useTrackActions(undefined, undefined));
    let nothingPlaying: unknown;
    await act(async () => {
      nothingPlaying = await idle.result.current.addTags(["idm"]);
    });
    expect(nothingPlaying).toEqual({ success: false, error: "Nothing is playing right now." });
    expect(addTags).not.toHaveBeenCalled();
  });

  it("adds tags and reports a failure's message", async () => {
    const addTags = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("denied"));
    installLastfm({ addTags });
    const { result } = renderHook(() => useTrackActions("Radiohead", "Nude"));

    await act(async () => {
      await expect(result.current.addTags(["idm"])).resolves.toEqual({ success: true });
    });
    await act(async () => {
      await expect(result.current.addTags(["idm"])).resolves.toEqual({
        success: false,
        error: "denied",
      });
    });
    expect(result.current.error).toBe("denied");
  });
});

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAccountAvatars } from "../../src/renderer/src/hooks/use-account-avatars.js";

describe("useAccountAvatars", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "lastfm");
  });

  it("collects each account's avatar as its lookup settles", async () => {
    Object.defineProperty(window, "lastfm", {
      value: {
        getUserInfo: vi.fn((username: string) =>
          username === "alice"
            ? Promise.resolve({ avatarUrl: "https://img/alice.png" })
            : Promise.reject(new Error("nope")),
        ),
      },
      configurable: true,
    });

    const { result } = renderHook(() => useAccountAvatars(["alice", "bob"]));

    await vi.waitFor(() => {
      expect(result.current).toEqual({ alice: "https://img/alice.png", bob: undefined });
    });
  });

  it("ignores lookups that settle after the hook has unmounted", async () => {
    let resolveLookup: (value: { avatarUrl: string }) => void = () => undefined;
    Object.defineProperty(window, "lastfm", {
      value: {
        getUserInfo: vi.fn(
          () =>
            new Promise((resolve) => {
              resolveLookup = resolve;
            }),
        ),
      },
      configurable: true,
    });

    const { result, unmount } = renderHook(() => useAccountAvatars(["alice"]));
    unmount();
    await act(async () => {
      resolveLookup({ avatarUrl: "https://img/late.png" });
      await Promise.resolve();
    });

    expect(result.current).toEqual({});
  });
});

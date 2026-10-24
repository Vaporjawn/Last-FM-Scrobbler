import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ListenBrainzApi } from "../../src/shared/secondary-auth-api.js";
import { useListenBrainzAuth } from "../../src/renderer/src/hooks/use-listenbrainz-auth.js";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function installFakeListenBrainzApi(overrides: Partial<ListenBrainzApi> = {}): ListenBrainzApi {
  const api: ListenBrainzApi = {
    connect: vi.fn().mockResolvedValue({ username: "listener" }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getActiveAccount: vi.fn().mockResolvedValue("listener"),
    ...overrides,
  };
  Object.defineProperty(window, "listenbrainz", { value: api, configurable: true });
  return api;
}

describe("useListenBrainzAuth", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "listenbrainz");
  });

  it("loads the active account on mount", async () => {
    installFakeListenBrainzApi();

    const { result } = renderHook(() => useListenBrainzAuth());

    await waitFor(() => {
      expect(result.current.activeAccount).toBe("listener");
    });
  });

  it("reports connect and disconnect as unavailable outside a real Electron renderer", async () => {
    const { result } = renderHook(() => useListenBrainzAuth());

    await act(async () => {
      await expect(result.current.connect("token")).resolves.toMatchObject({ success: false });
      await expect(result.current.disconnect()).resolves.toMatchObject({ success: false });
    });
  });

  it("connects and disconnects, refreshing the active account each time", async () => {
    const connect = vi.fn().mockResolvedValue({ username: "listener" });
    const getActiveAccount = vi.fn().mockResolvedValue("listener");
    installFakeListenBrainzApi({ connect, getActiveAccount });
    const { result } = renderHook(() => useListenBrainzAuth());
    await waitFor(() => {
      expect(result.current.activeAccount).toBe("listener");
    });

    await act(async () => {
      await expect(result.current.connect("token")).resolves.toEqual({ success: true });
      await expect(result.current.disconnect()).resolves.toEqual({ success: true });
    });

    expect(connect).toHaveBeenCalledWith("token");
    expect(getActiveAccount).toHaveBeenCalledTimes(3);
    expect(result.current.isConnecting).toBe(false);
  });

  it("surfaces a failed connect or disconnect as the hook's error", async () => {
    installFakeListenBrainzApi({
      connect: vi.fn().mockRejectedValue(new Error("bad token")),
      disconnect: vi.fn().mockRejectedValue(new Error("cannot disconnect")),
    });
    const { result } = renderHook(() => useListenBrainzAuth());
    await waitFor(() => {
      expect(result.current.activeAccount).toBe("listener");
    });

    await act(async () => {
      await expect(result.current.connect("token")).resolves.toEqual({
        success: false,
        error: "bad token",
      });
    });
    expect(result.current.error).toBe("bad token");

    await act(async () => {
      await expect(result.current.disconnect()).resolves.toEqual({
        success: false,
        error: "cannot disconnect",
      });
    });
    expect(result.current.error).toBe("cannot disconnect");
  });

  it("describes a non-Error refresh failure by its string form", async () => {
    installFakeListenBrainzApi({ getActiveAccount: vi.fn().mockRejectedValue("plain failure") });

    const { result } = renderHook(() => useListenBrainzAuth());

    await waitFor(() => {
      expect(result.current.error).toBe("plain failure");
    });
  });

  it("drops a refresh result, and a refresh failure, superseded by a newer refresh", async () => {
    const slowSuccess = deferred<string | undefined>();
    const slowFailure = deferred<string | undefined>();
    let calls = 0;
    const getActiveAccount = vi.fn(() => {
      calls += 1;
      if (calls === 1) return slowSuccess.promise;
      if (calls === 2) return slowFailure.promise;
      return Promise.resolve("final");
    });
    installFakeListenBrainzApi({ getActiveAccount });
    const { result } = renderHook(() => useListenBrainzAuth());
    await waitFor(() => {
      expect(getActiveAccount).toHaveBeenCalledTimes(1);
    });

    act(() => {
      void result.current.disconnect();
    });
    await waitFor(() => {
      expect(getActiveAccount).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      await result.current.disconnect();
    });
    await act(async () => {
      slowSuccess.resolve("stale");
      slowFailure.reject(new Error("stale failure"));
      await Promise.resolve();
    });

    expect(result.current.activeAccount).toBe("final");
    expect(result.current.error).toBeUndefined();
  });

  it("reports an Error's message when a refresh fails", async () => {
    installFakeListenBrainzApi({
      getActiveAccount: vi.fn().mockRejectedValue(new Error("ipc down")),
    });

    const { result } = renderHook(() => useListenBrainzAuth());

    await waitFor(() => {
      expect(result.current.error).toBe("ipc down");
    });
  });
});

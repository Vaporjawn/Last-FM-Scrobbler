import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LibrefmApi } from "../../src/shared/secondary-auth-api.js";
import { useLibrefmAuth } from "../../src/renderer/src/hooks/use-librefm-auth.js";

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

function installFakeLibrefmApi(overrides: Partial<LibrefmApi> = {}): LibrefmApi {
  const api: LibrefmApi = {
    isConfigured: vi.fn().mockResolvedValue(true),
    credentialsSource: vi.fn().mockResolvedValue("user-supplied"),
    setCredentials: vi.fn().mockResolvedValue(undefined),
    clearCredentials: vi.fn().mockResolvedValue(undefined),
    login: vi.fn().mockResolvedValue({ username: "alice" }),
    logout: vi.fn().mockResolvedValue(undefined),
    getActiveAccount: vi.fn().mockResolvedValue("alice"),
    ...overrides,
  };
  Object.defineProperty(window, "librefm", { value: api, configurable: true });
  return api;
}

describe("useLibrefmAuth", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "librefm");
  });

  it("loads the configuration and active account on mount", async () => {
    installFakeLibrefmApi();

    const { result } = renderHook(() => useLibrefmAuth());

    await waitFor(() => {
      expect(result.current.activeAccount).toBe("alice");
    });
    expect(result.current).toMatchObject({
      isConfigured: true,
      credentialsSource: "user-supplied",
    });
  });

  it("reports every action as unavailable outside a real Electron renderer", async () => {
    const { result } = renderHook(() => useLibrefmAuth());

    await act(async () => {
      await expect(result.current.logout()).resolves.toMatchObject({ success: false });
      await expect(result.current.clearCredentials()).resolves.toMatchObject({ success: false });
      await expect(result.current.login()).resolves.toMatchObject({ success: false });
      await expect(result.current.saveCredentials("k", "s")).resolves.toMatchObject({
        success: false,
      });
    });
    expect(result.current.isLoggingIn).toBe(false);
    expect(result.current.isSavingCredentials).toBe(false);
  });

  it("runs login, logout, saving and clearing credentials, refreshing afterwards", async () => {
    const setCredentials = vi.fn().mockResolvedValue(undefined);
    const getActiveAccount = vi.fn().mockResolvedValue("alice");
    installFakeLibrefmApi({ setCredentials, getActiveAccount });
    const { result } = renderHook(() => useLibrefmAuth());
    await waitFor(() => {
      expect(result.current.isConfigured).toBe(true);
    });

    await act(async () => {
      await expect(result.current.login()).resolves.toEqual({ success: true });
      await expect(result.current.logout()).resolves.toEqual({ success: true });
      await expect(result.current.saveCredentials("k", "s")).resolves.toEqual({ success: true });
      await expect(result.current.clearCredentials()).resolves.toEqual({ success: true });
    });

    expect(setCredentials).toHaveBeenCalledWith("k", "s");
    expect(getActiveAccount).toHaveBeenCalledTimes(5);
  });

  it("surfaces an action's failure as the hook's error", async () => {
    installFakeLibrefmApi({ login: vi.fn().mockRejectedValue(new Error("denied")) });
    const { result } = renderHook(() => useLibrefmAuth());
    await waitFor(() => {
      expect(result.current.isConfigured).toBe(true);
    });

    await act(async () => {
      await expect(result.current.login()).resolves.toEqual({ success: false, error: "denied" });
    });

    expect(result.current.error).toBe("denied");
    expect(result.current.isLoggingIn).toBe(false);
  });

  it("falls back to not configured, and describes a non-Error failure, when the initial refresh fails", async () => {
    installFakeLibrefmApi({ isConfigured: vi.fn().mockRejectedValue("plain failure") });

    const { result } = renderHook(() => useLibrefmAuth());

    await waitFor(() => {
      expect(result.current.error).toBe("plain failure");
    });
    expect(result.current.isConfigured).toBe(false);
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
    installFakeLibrefmApi({ getActiveAccount });
    const { result } = renderHook(() => useLibrefmAuth());
    await waitFor(() => {
      expect(getActiveAccount).toHaveBeenCalledTimes(1);
    });

    act(() => {
      void result.current.logout();
    });
    await waitFor(() => {
      expect(getActiveAccount).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      await result.current.clearCredentials();
    });
    await act(async () => {
      slowSuccess.resolve("stale");
      slowFailure.reject(new Error("stale failure"));
      await Promise.resolve();
    });

    expect(result.current.activeAccount).toBe("final");
    expect(result.current.error).toBeUndefined();
  });

  it("keeps the last known configuration when a later refresh fails", async () => {
    const isConfigured = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("ipc down"));
    installFakeLibrefmApi({ isConfigured });
    const { result } = renderHook(() => useLibrefmAuth());
    await waitFor(() => {
      expect(result.current.isConfigured).toBe(true);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isConfigured).toBe(true);
    expect(result.current.error).toBe("ipc down");
  });
});

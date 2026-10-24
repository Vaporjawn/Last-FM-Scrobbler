import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSettingsState } from "../../src/renderer/src/hooks/use-settings-state.js";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../../src/shared/settings-api.js";

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

function installSettings(api: {
  get?: () => Promise<AppSettings>;
  set?: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  reset?: () => Promise<AppSettings>;
}): void {
  Object.defineProperty(window, "settings", {
    value: {
      get: () => Promise.resolve(DEFAULT_APP_SETTINGS),
      set: (patch: Partial<AppSettings>) => Promise.resolve({ ...DEFAULT_APP_SETTINGS, ...patch }),
      reset: () => Promise.resolve(DEFAULT_APP_SETTINGS),
      ...api,
    },
    configurable: true,
  });
}

describe("useSettingsState", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "settings");
  });

  it("stops loading and keeps the defaults outside a real Electron renderer", async () => {
    const { result } = renderHook(() => useSettingsState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.settings).toEqual(DEFAULT_APP_SETTINGS);
    await expect(result.current.updateSettings({ themeMode: "light" })).resolves.toMatchObject({
      success: false,
    });
    await expect(result.current.resetSettings()).resolves.toMatchObject({ success: false });
  });

  it("ignores the initial load settling after unmount, whether it succeeds or fails", async () => {
    const success = deferred<AppSettings>();
    installSettings({ get: () => success.promise });
    const first = renderHook(() => useSettingsState());
    first.unmount();
    success.resolve({ ...DEFAULT_APP_SETTINGS, themeMode: "light" });
    await Promise.resolve();
    expect(first.result.current.settings).toEqual(DEFAULT_APP_SETTINGS);

    const failure = deferred<AppSettings>();
    installSettings({ get: () => failure.promise });
    const second = renderHook(() => useSettingsState());
    second.unmount();
    failure.reject(new Error("late"));
    await Promise.resolve();
    expect(second.result.current.error).toBeUndefined();
  });

  it("reports an initial load failure", async () => {
    installSettings({ get: () => Promise.reject(new Error("disk unreadable")) });

    const { result } = renderHook(() => useSettingsState());

    await waitFor(() => {
      expect(result.current.error).toBe("disk unreadable");
    });
    expect(result.current.loading).toBe(false);
  });

  it("lets the newest update win when an older one settles later, and ignores an older failure", async () => {
    const older = deferred<AppSettings>();
    const newer = deferred<AppSettings>();
    const set = vi
      .fn<(patch: Partial<AppSettings>) => Promise<AppSettings>>()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    installSettings({ set });
    const { result } = renderHook(() => useSettingsState());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let olderResult: Promise<unknown> = Promise.resolve();
    let newerResult: Promise<unknown> = Promise.resolve();
    act(() => {
      olderResult = result.current.updateSettings({ themeMode: "light" });
      newerResult = result.current.updateSettings({ themeMode: "dark" });
    });
    await act(async () => {
      newer.resolve({ ...DEFAULT_APP_SETTINGS, themeMode: "dark" });
      await newerResult;
    });
    await act(async () => {
      older.reject(new Error("older failed"));
      await olderResult;
    });

    expect(result.current.settings.themeMode).toBe("dark");
  });

  it("does not apply an older update's result over a newer one", async () => {
    const older = deferred<AppSettings>();
    const newer = deferred<AppSettings>();
    const set = vi
      .fn<(patch: Partial<AppSettings>) => Promise<AppSettings>>()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    installSettings({ set });
    const { result } = renderHook(() => useSettingsState());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let olderResult: Promise<unknown> = Promise.resolve();
    act(() => {
      olderResult = result.current.updateSettings({ themeMode: "light" });
      void result.current.updateSettings({ themeMode: "dark" });
    });
    await act(async () => {
      older.resolve({ ...DEFAULT_APP_SETTINGS, themeMode: "light" });
      await olderResult;
    });

    expect(result.current.settings.themeMode).toBe("dark");
  });

  it("rolls back a failed update to the previous settings and reports the error", async () => {
    installSettings({ set: () => Promise.reject(new Error("write failed")) });
    const { result } = renderHook(() => useSettingsState());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Started in a synchronous act() so React has applied the optimistic update (and
    // so captured the previous settings) before the rejection is handled.
    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.updateSettings({ themeMode: "light" });
    });
    await act(async () => {
      await pending;
    });

    expect(result.current.settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(result.current.error).toBe("write failed");
  });

  it("resets to the saved defaults, rolls back a failed reset, and ignores superseded resets", async () => {
    const older = deferred<AppSettings>();
    const newer = deferred<AppSettings>();
    const reset = vi
      .fn<() => Promise<AppSettings>>()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise)
      .mockRejectedValueOnce(new Error("reset failed"));
    installSettings({ reset });
    const { result } = renderHook(() => useSettingsState());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let olderResult: Promise<unknown> = Promise.resolve();
    let newerResult: Promise<unknown> = Promise.resolve();
    act(() => {
      olderResult = result.current.resetSettings();
      newerResult = result.current.resetSettings();
    });
    await act(async () => {
      newer.resolve(DEFAULT_APP_SETTINGS);
      await newerResult;
    });
    await act(async () => {
      older.reject(new Error("older reset failed"));
      await olderResult;
    });
    expect(result.current.settings).toEqual(DEFAULT_APP_SETTINGS);

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.resetSettings();
    });
    await act(async () => {
      await pending;
    });
    expect(result.current.error).toBe("reset failed");
  });

  it("does not apply a superseded reset's result", async () => {
    const older = deferred<AppSettings>();
    const reset = vi
      .fn<() => Promise<AppSettings>>()
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce(DEFAULT_APP_SETTINGS);
    installSettings({
      reset,
      set: (patch) => Promise.resolve({ ...DEFAULT_APP_SETTINGS, ...patch }),
    });
    const { result } = renderHook(() => useSettingsState());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let olderResult: Promise<unknown> = Promise.resolve();
    act(() => {
      olderResult = result.current.resetSettings();
    });
    await act(async () => {
      await result.current.updateSettings({ themeMode: "light" });
    });
    await act(async () => {
      older.resolve({ ...DEFAULT_APP_SETTINGS, themeMode: "dark" });
      await olderResult;
    });

    expect(result.current.settings.themeMode).toBe("light");
  });
});

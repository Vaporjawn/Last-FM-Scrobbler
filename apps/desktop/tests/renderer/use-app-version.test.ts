import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useAppVersion } from "../../src/renderer/src/hooks/use-app-version.js";

function installAppInfo(getVersion: () => Promise<string>): void {
  Object.defineProperty(window, "appInfo", {
    value: { getVersion, showMainWindow: () => Promise.resolve() },
    configurable: true,
  });
}

describe("useAppVersion", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "appInfo");
  });

  it("is undefined outside a real Electron renderer", () => {
    const { result } = renderHook(() => useAppVersion());

    expect(result.current).toBeUndefined();
  });

  it("reports the app version once it resolves", async () => {
    installAppInfo(() => Promise.resolve("1.2.3"));

    const { result } = renderHook(() => useAppVersion());

    await waitFor(() => {
      expect(result.current).toBe("1.2.3");
    });
  });

  it("stays undefined when the lookup fails", async () => {
    let rejected = false;
    installAppInfo(() => {
      rejected = true;
      return Promise.reject(new Error("ipc down"));
    });

    const { result } = renderHook(() => useAppVersion());

    await waitFor(() => {
      expect(rejected).toBe(true);
    });
    expect(result.current).toBeUndefined();
  });

  it("ignores a lookup that settles after unmount", async () => {
    let resolveVersion: (version: string) => void = () => undefined;
    let rejectVersion: (error: Error) => void = () => undefined;
    installAppInfo(
      () =>
        new Promise<string>((resolve, reject) => {
          resolveVersion = resolve;
          rejectVersion = reject;
        }),
    );

    const first = renderHook(() => useAppVersion());
    first.unmount();
    resolveVersion("9.9.9");
    await Promise.resolve();
    expect(first.result.current).toBeUndefined();

    const second = renderHook(() => useAppVersion());
    second.unmount();
    rejectVersion(new Error("late failure"));
    await Promise.resolve();
    expect(second.result.current).toBeUndefined();
  });
});

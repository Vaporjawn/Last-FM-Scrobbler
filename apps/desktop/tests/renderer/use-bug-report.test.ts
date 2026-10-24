import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBugReport } from "../../src/renderer/src/hooks/use-bug-report.js";

function installBugReport(api: {
  isConfigured?: () => Promise<boolean>;
  submit?: (title: string, body: string) => Promise<{ issueUrl: string }>;
}): void {
  Object.defineProperty(window, "bugReport", {
    value: {
      isConfigured: () => Promise.resolve(true),
      submit: () => Promise.resolve({ issueUrl: "https://github.com/x/y/issues/1" }),
      ...api,
    },
    configurable: true,
  });
}

describe("useBugReport", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "bugReport");
  });

  it("is not configured outside a real Electron renderer and ignores submit", async () => {
    const { result } = renderHook(() => useBugReport());

    expect(result.current.isConfigured).toBe(false);
    await act(async () => {
      await result.current.submit("Title", "Body");
    });
    expect(result.current.issueUrl).toBeUndefined();
  });

  it("treats a failed configuration check as not configured", async () => {
    installBugReport({ isConfigured: () => Promise.reject(new Error("ipc down")) });

    const { result } = renderHook(() => useBugReport());

    await waitFor(() => {
      expect(result.current.isConfigured).toBe(false);
    });
  });

  it("submits a report and exposes the created issue URL", async () => {
    installBugReport({});
    const { result } = renderHook(() => useBugReport());
    await waitFor(() => {
      expect(result.current.isConfigured).toBe(true);
    });

    await act(async () => {
      await result.current.submit("Title", "Body");
    });

    expect(result.current.issueUrl).toBe("https://github.com/x/y/issues/1");
    expect(result.current.submitting).toBe(false);
  });

  it("reports an Error's message, or a non-Error's string form, when submitting fails", async () => {
    const submit = vi
      .fn<(title: string, body: string) => Promise<{ issueUrl: string }>>()
      .mockRejectedValueOnce(new Error("relay down"))

      .mockRejectedValueOnce("plain failure");
    installBugReport({ submit });
    const { result } = renderHook(() => useBugReport());

    await act(async () => {
      await result.current.submit("Title", "Body");
    });
    expect(result.current.error).toBe("relay down");

    await act(async () => {
      await result.current.submit("Title", "Body");
    });
    expect(result.current.error).toBe("plain failure");
  });
});

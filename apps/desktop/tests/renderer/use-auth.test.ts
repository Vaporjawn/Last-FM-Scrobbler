import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../../src/shared/auth-api.js";
import { useAuth } from "../../src/renderer/src/hooks/use-auth.js";

// See use-recent-tracks.test.ts's own note on why this codebase otherwise avoids
// dedicated hook test files — useAuth gets one for the same reason
// use-now-playing.test.ts/use-updates.test.ts do: its refresh() stale-response
// guard needs precise control over promise-resolution ordering across two concurrent
// calls that's impractical to drive through a rendered page's DOM alone. The same
// generation-ref fix (and the same underlying race) also applies to
// use-librefm-auth.ts and use-listenbrainz-auth.ts, verified via typecheck and their
// existing SettingsPage.test.tsx coverage — not independently re-tested here to avoid
// three near-identical copies of this exact scenario.

/** A promise plus its own externally-callable resolve — for tests that need to
 * control exactly when one of refresh()'s underlying calls settles relative to
 * another overlapping refresh() call. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function installFakeAuthApi(overrides: Partial<AuthApi> = {}): AuthApi {
  const api: AuthApi = {
    isConfigured: vi.fn().mockResolvedValue(true),
    credentialsSource: vi.fn().mockResolvedValue("environment"),
    login: vi.fn().mockResolvedValue({ username: "alice" }),
    logout: vi.fn().mockResolvedValue(undefined),
    listAccounts: vi.fn().mockResolvedValue([]),
    getActiveAccount: vi.fn().mockResolvedValue(undefined),
    setActiveAccount: vi.fn().mockResolvedValue(undefined),
    setAppCredentials: vi.fn().mockResolvedValue(undefined),
    clearAppCredentials: vi.fn().mockResolvedValue(undefined),
    relaunch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  Object.defineProperty(window, "auth", { value: api, configurable: true });
  return api;
}

describe("useAuth", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "auth");
  });

  it("returns inert defaults when window.auth isn't present", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isConfigured).toBeUndefined();
    expect(result.current.accounts).toEqual([]);
  });

  it("loads accounts/active account on mount", async () => {
    installFakeAuthApi({
      listAccounts: vi.fn().mockResolvedValue(["alice", "bob"]),
      getActiveAccount: vi.fn().mockResolvedValue("alice"),
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.accounts).toEqual(["alice", "bob"]);
    });
    expect(result.current.activeAccount).toBe("alice");
  });

  it("does not let a stale (slower) refresh() response clobber a newer, faster one", async () => {
    // Regression test: two overlapping refresh() calls (e.g. "switch to alice" then,
    // before that IPC round trip resolves, "log out bob" on a different row — neither
    // button is disabled while the other's refresh() is in flight) used to apply in
    // resolution order rather than call order. The underlying main handlers do real
    // I/O (OS keychain reads via AccountStore), so out-of-order resolution is
    // realistic, not theoretical.
    //
    // Branches explicitly on call number (not chained mockResolvedValueOnce calls)
    // to account for the hook's own initial mount-triggered refresh() call as call #1
    // — leaving that implicit would silently consume the "stale" slot intended for
    // the setActiveAccount action below instead.
    const pendingCall = deferred<readonly string[]>();
    let callCount = 0;
    const listAccounts = vi.fn(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.resolve(["alice", "bob"]); // the initial mount's own refresh()
      }
      if (callCount === 2) {
        return pendingCall.promise; // triggered by setActiveAccount below
      }
      return Promise.resolve(["bob"]); // triggered by logout below, resolves first
    });
    installFakeAuthApi({ listAccounts, getActiveAccount: vi.fn().mockResolvedValue("bob") });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => {
      expect(result.current.accounts).toEqual(["alice", "bob"]);
    });

    // First action: switch to alice — its own refresh()'s listAccounts() call (#2)
    // stays pending.
    let firstActionSettled = false;
    act(() => {
      void result.current.setActiveAccount("alice").then(() => {
        firstActionSettled = true;
      });
    });
    await waitFor(() => {
      expect(listAccounts).toHaveBeenCalledTimes(2);
    });

    // Second, later action: log out bob — its refresh() call (#3) resolves
    // immediately.
    await act(async () => {
      await result.current.logout("bob");
    });

    expect(listAccounts).toHaveBeenCalledTimes(3);
    expect(result.current.accounts).toEqual(["bob"]);

    // The first (stale) refresh() call (#2) finally resolves, with data from
    // *before* the logout — it must not overwrite the second, newer call's
    // already-applied result.
    await act(async () => {
      pendingCall.resolve(["alice", "bob"]);
      await pendingCall.promise;
    });
    expect(firstActionSettled).toBe(true);

    expect(result.current.accounts).toEqual(["bob"]);
  });
});

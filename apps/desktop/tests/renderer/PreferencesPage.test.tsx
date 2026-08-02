import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../../src/shared/auth-api.js";
import { PreferencesPage } from "../../src/renderer/src/pages/PreferencesPage.js";

function installFakeAuthApi(overrides: Partial<AuthApi> = {}): void {
  const api: AuthApi = {
    isConfigured: vi.fn().mockResolvedValue(true),
    login: vi.fn().mockResolvedValue({ username: "alice" }),
    logout: vi.fn().mockResolvedValue(undefined),
    listAccounts: vi.fn().mockResolvedValue([]),
    getActiveAccount: vi.fn().mockResolvedValue(undefined),
    setActiveAccount: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  Object.defineProperty(window, "auth", { value: api, configurable: true });
}

describe("PreferencesPage", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "auth");
  });

  it("shows a 'not configured' message when the app has no Last.fm API credentials", async () => {
    installFakeAuthApi({ isConfigured: vi.fn().mockResolvedValue(false) });

    render(<PreferencesPage />);

    expect(await screen.findByText(/no last\.fm api credentials configured/i)).toBeInTheDocument();
  });

  it("shows a login button when configured but no account is logged in", async () => {
    installFakeAuthApi({
      isConfigured: vi.fn().mockResolvedValue(true),
      listAccounts: vi.fn().mockResolvedValue([]),
    });

    render(<PreferencesPage />);

    expect(await screen.findByRole("button", { name: /log in with last\.fm/i })).toBeInTheDocument();
  });

  it("clicking login calls window.auth.login()", async () => {
    const login = vi.fn().mockResolvedValue({ username: "alice" });
    installFakeAuthApi({ listAccounts: vi.fn().mockResolvedValue([]), login });

    render(<PreferencesPage />);
    const loginButton = await screen.findByRole("button", { name: /log in with last\.fm/i });
    act(() => {
      fireEvent.click(loginButton);
    });

    await waitFor(() => {
      expect(login).toHaveBeenCalled();
    });
  });

  it("shows the logged-in account and marks it active", async () => {
    installFakeAuthApi({
      listAccounts: vi.fn().mockResolvedValue(["alice"]),
      getActiveAccount: vi.fn().mockResolvedValue("alice"),
    });

    render(<PreferencesPage />);

    expect(await screen.findByText("alice")).toBeInTheDocument();
  });

  it("clicking log out calls window.auth.logout() with the right username", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    installFakeAuthApi({
      listAccounts: vi.fn().mockResolvedValue(["alice"]),
      getActiveAccount: vi.fn().mockResolvedValue("alice"),
      logout,
    });

    render(<PreferencesPage />);
    const logoutButton = await screen.findByRole("button", { name: /log out/i });
    act(() => {
      fireEvent.click(logoutButton);
    });

    await waitFor(() => {
      expect(logout).toHaveBeenCalledWith("alice");
    });
  });
});

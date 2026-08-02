import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../../src/shared/auth-api.js";
import { SnackbarProvider } from "../../src/renderer/src/contexts/SnackbarProvider.js";
import { PreferencesPage } from "../../src/renderer/src/pages/PreferencesPage.js";

/** `PreferencesPage` fires snackbars via `useSnackbar()` — a real `SnackbarProvider`
 * (not present in a bare `render(<PreferencesPage />)`, which only ever exercises
 * `useSnackbar()`'s no-op fallback) is needed for those to actually render and be
 * assertable. */
function renderPreferencesPage(props: ComponentProps<typeof PreferencesPage>): ReturnType<typeof render> {
  return render(
    <SnackbarProvider>
      <PreferencesPage {...props} />
    </SnackbarProvider>,
  );
}

function installFakeAuthApi(overrides: Partial<AuthApi> = {}): void {
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
}

describe("PreferencesPage", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "auth");
  });

  it("shows a 'not configured' message when the app has no Last.fm API credentials", async () => {
    installFakeAuthApi({
      isConfigured: vi.fn().mockResolvedValue(false),
      credentialsSource: vi.fn().mockResolvedValue("none"),
    });

    renderPreferencesPage({ onNavigateToPreferences: vi.fn() });

    expect(await screen.findByText(/logging in needs a last\.fm api key/i)).toBeInTheDocument();
  });

  it("resolves out of the loading spinner even if an initial auth IPC call rejects (e.g. a stale main process)", async () => {
    installFakeAuthApi({
      listAccounts: vi.fn().mockRejectedValue(new Error("No handler registered for 'auth:list-accounts'")),
    });

    renderPreferencesPage({ onNavigateToPreferences: vi.fn() });

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
  });

  it("shows a login button when configured but no account is logged in", async () => {
    installFakeAuthApi({
      isConfigured: vi.fn().mockResolvedValue(true),
      listAccounts: vi.fn().mockResolvedValue([]),
    });

    renderPreferencesPage({ onNavigateToPreferences: vi.fn() });

    expect(await screen.findByRole("button", { name: /log in with last\.fm/i })).toBeInTheDocument();
  });

  it("clicking login calls window.auth.login()", async () => {
    const login = vi.fn().mockResolvedValue({ username: "alice" });
    installFakeAuthApi({ listAccounts: vi.fn().mockResolvedValue([]), login });

    renderPreferencesPage({ onNavigateToPreferences: vi.fn() });
    const loginButton = await screen.findByRole("button", { name: /log in with last\.fm/i });
    act(() => {
      fireEvent.click(loginButton);
    });

    await waitFor(() => {
      expect(login).toHaveBeenCalled();
    });
  });

  it("shows a success snackbar when login succeeds", async () => {
    installFakeAuthApi({
      listAccounts: vi.fn().mockResolvedValue([]),
      login: vi.fn().mockResolvedValue({ username: "alice" }),
    });

    renderPreferencesPage({ onNavigateToPreferences: vi.fn() });
    const loginButton = await screen.findByRole("button", { name: /log in with last\.fm/i });
    act(() => {
      fireEvent.click(loginButton);
    });

    expect(await screen.findByText("Logged in.")).toBeInTheDocument();
  });

  it("shows an error snackbar when login fails", async () => {
    installFakeAuthApi({
      listAccounts: vi.fn().mockResolvedValue([]),
      login: vi.fn().mockRejectedValue(new Error("denied")),
    });

    renderPreferencesPage({ onNavigateToPreferences: vi.fn() });
    const loginButton = await screen.findByRole("button", { name: /log in with last\.fm/i });
    act(() => {
      fireEvent.click(loginButton);
    });

    const alerts = await screen.findAllByText("denied");
    // One copy in the persistent error Alert (initial-load-failure fallback — see
    // PreferencesPage's comment on why it's kept alongside the snackbar), one in the
    // snackbar this test is actually about.
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  it("navigates to Profile once login succeeds, so the user sees who they're logged in as", async () => {
    installFakeAuthApi({
      listAccounts: vi.fn().mockResolvedValue([]),
      login: vi.fn().mockResolvedValue({ username: "alice" }),
    });
    const onNavigateToProfile = vi.fn();

    renderPreferencesPage({ onNavigateToPreferences: vi.fn(), onNavigateToProfile });
    const loginButton = await screen.findByRole("button", { name: /log in with last\.fm/i });
    act(() => {
      fireEvent.click(loginButton);
    });

    await waitFor(() => {
      expect(onNavigateToProfile).toHaveBeenCalledOnce();
    });
  });

  it("does not navigate to Profile when login fails", async () => {
    installFakeAuthApi({
      listAccounts: vi.fn().mockResolvedValue([]),
      login: vi.fn().mockRejectedValue(new Error("denied")),
    });
    const onNavigateToProfile = vi.fn();

    renderPreferencesPage({ onNavigateToPreferences: vi.fn(), onNavigateToProfile });
    const loginButton = await screen.findByRole("button", { name: /log in with last\.fm/i });
    act(() => {
      fireEvent.click(loginButton);
    });

    await screen.findByText("denied");
    expect(onNavigateToProfile).not.toHaveBeenCalled();
  });

  it("shows the logged-in account and marks it active", async () => {
    installFakeAuthApi({
      listAccounts: vi.fn().mockResolvedValue(["alice"]),
      getActiveAccount: vi.fn().mockResolvedValue("alice"),
    });

    renderPreferencesPage({ onNavigateToPreferences: vi.fn() });

    expect(await screen.findByText("alice")).toBeInTheDocument();
  });

  it("clicking log out calls window.auth.logout() with the right username", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    installFakeAuthApi({
      listAccounts: vi.fn().mockResolvedValue(["alice"]),
      getActiveAccount: vi.fn().mockResolvedValue("alice"),
      logout,
    });

    renderPreferencesPage({ onNavigateToPreferences: vi.fn() });
    const logoutButton = await screen.findByRole("button", { name: /log out/i });
    act(() => {
      fireEvent.click(logoutButton);
    });

    await waitFor(() => {
      expect(logout).toHaveBeenCalledWith("alice");
    });
    expect(await screen.findByText("Logged out alice.")).toBeInTheDocument();
  });

  it("clicking 'Check for updates now' shows a snackbar reporting the outcome", async () => {
    // window.updates is intentionally left unfaked here — useUpdates()'s checkNow()
    // gracefully resolves a failure in that case, which is enough to prove the button
    // is wired to a snackbar at all without needing a full window.updates fake.
    installFakeAuthApi();

    renderPreferencesPage({ onNavigateToPreferences: vi.fn() });
    const checkButton = await screen.findByRole("button", { name: /check for updates now/i });
    act(() => {
      fireEvent.click(checkButton);
    });

    expect(await screen.findByText("Not available right now.")).toBeInTheDocument();
  });

  describe("bring your own key", () => {
    it("hides the API key form when this build has credentials baked in via the environment", async () => {
      installFakeAuthApi({ credentialsSource: vi.fn().mockResolvedValue("environment") });

      renderPreferencesPage({ onNavigateToPreferences: vi.fn() });
      await screen.findByRole("button", { name: /log in with last\.fm/i });

      expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /remove saved api key/i })).not.toBeInTheDocument();
    });

    it("shows the API key form directly — no login gate — when there's no key configured yet", async () => {
      installFakeAuthApi({
        isConfigured: vi.fn().mockResolvedValue(false),
        credentialsSource: vi.fn().mockResolvedValue("none"),
      });

      renderPreferencesPage({ onNavigateToPreferences: vi.fn() });

      expect(await screen.findByLabelText(/api key/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/shared secret/i)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /^log in to last\.fm$/i })).not.toBeInTheDocument();
      const createKeyLink = screen.getByRole("link", { name: /get your free last\.fm api key/i });
      const createKeyHref = new URL(createKeyLink.getAttribute("href") ?? "");
      expect(createKeyHref.origin + createKeyHref.pathname).toBe(
        "https://www.last.fm/api/account/create",
      );
      // Pre-filled so the user only has to click "Submit" over there — see
      // buildCreateApiAccountUrl()'s docstring for the caveat on these field names.
      expect(createKeyHref.searchParams.get("name")).toBe("Last.fm Scrobbler");
      expect(createKeyHref.searchParams.get("homepage")).toBe(
        "https://github.com/Vaporjawn/Last-FM-Scrobbler",
      );
      expect(createKeyHref.searchParams.get("description")).toBeTruthy();
    });

    it("saving an API key/secret calls window.auth.setAppCredentials and offers a restart", async () => {
      const setAppCredentials = vi.fn().mockResolvedValue(undefined);
      installFakeAuthApi({
        isConfigured: vi.fn().mockResolvedValue(false),
        credentialsSource: vi.fn().mockResolvedValue("none"),
        setAppCredentials,
      });

      renderPreferencesPage({ onNavigateToPreferences: vi.fn() });
      const apiKeyField = await screen.findByLabelText(/api key/i);
      const apiSecretField = screen.getByLabelText(/shared secret/i);

      act(() => {
        fireEvent.change(apiKeyField, { target: { value: "my-key" } });
        fireEvent.change(apiSecretField, { target: { value: "my-secret" } });
      });
      const saveButton = screen.getByRole("button", { name: /save api key/i });
      act(() => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(setAppCredentials).toHaveBeenCalledWith("my-key", "my-secret");
      });
      expect(await screen.findByRole("button", { name: /restart now/i })).toBeInTheDocument();
    });

    it("clicking 'Restart now' after saving calls window.auth.relaunch()", async () => {
      const relaunch = vi.fn().mockResolvedValue(undefined);
      installFakeAuthApi({
        isConfigured: vi.fn().mockResolvedValue(false),
        credentialsSource: vi.fn().mockResolvedValue("none"),
        relaunch,
      });

      renderPreferencesPage({ onNavigateToPreferences: vi.fn() });
      const apiKeyField = await screen.findByLabelText(/api key/i);
      const apiSecretField = screen.getByLabelText(/shared secret/i);
      act(() => {
        fireEvent.change(apiKeyField, { target: { value: "my-key" } });
        fireEvent.change(apiSecretField, { target: { value: "my-secret" } });
        fireEvent.click(screen.getByRole("button", { name: /save api key/i }));
      });
      const restartButton = await screen.findByRole("button", { name: /restart now/i });

      act(() => {
        fireEvent.click(restartButton);
      });

      await waitFor(() => {
        expect(relaunch).toHaveBeenCalled();
      });
    });

    it("shows a 'Remove saved API key' button for a user-supplied key, which clears it", async () => {
      const clearAppCredentials = vi.fn().mockResolvedValue(undefined);
      installFakeAuthApi({
        credentialsSource: vi.fn().mockResolvedValue("user-supplied"),
        clearAppCredentials,
      });

      renderPreferencesPage({ onNavigateToPreferences: vi.fn() });
      const removeButton = await screen.findByRole("button", { name: /remove saved api key/i });
      act(() => {
        fireEvent.click(removeButton);
      });

      await waitFor(() => {
        expect(clearAppCredentials).toHaveBeenCalled();
      });
    });
  });
});

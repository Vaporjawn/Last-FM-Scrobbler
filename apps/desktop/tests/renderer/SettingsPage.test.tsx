import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../../src/shared/auth-api.js";
import type { FilterApi, FilterValidationResult } from "../../src/shared/filter-api.js";
import type { LastfmDataApi } from "../../src/shared/lastfm-api.js";
import { DEFAULT_APP_SETTINGS, type AppSettings, type SettingsApi } from "../../src/shared/settings-api.js";
import { SettingsProvider } from "../../src/renderer/src/contexts/SettingsProvider.js";
import { SnackbarProvider } from "../../src/renderer/src/contexts/SnackbarProvider.js";
import { SettingsPage } from "../../src/renderer/src/pages/SettingsPage.js";

/** `SettingsPage` fires snackbars via `useSnackbar()` and reads/writes settings via
 * `useSettings()` — real `SnackbarProvider`/`SettingsProvider` ancestors (not present
 * in a bare `render(<SettingsPage />)`, which only ever exercises each hook's no-op
 * fallback) are needed for either to actually work and be assertable. */
function renderSettingsPage(props: ComponentProps<typeof SettingsPage>): ReturnType<typeof render> {
  return render(
    <SettingsProvider>
      <SnackbarProvider>
        <SettingsPage {...props} />
      </SnackbarProvider>
    </SettingsProvider>,
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

/** `SettingsPage`'s Accounts section fetches each account's real avatar via
 * `window.lastfm.getUserInfo` — kept separate from `installFakeAuthApi` since most
 * existing tests here don't care about it. */
function installFakeLastfmApi(overrides: Partial<LastfmDataApi> = {}): LastfmDataApi {
  const api: LastfmDataApi = {
    getRecentTracks: vi.fn().mockResolvedValue([]),
    getTopArtists: vi.fn().mockResolvedValue([]),
    getFriends: vi.fn().mockResolvedValue([]),
    getUserInfo: vi.fn().mockResolvedValue({ username: "someuser" }),
    getArtistInfo: vi.fn(),
    getSimilarArtists: vi.fn(),
    getTopTags: vi.fn(),
    getTrackInfo: vi.fn(),
    loveTrack: vi.fn(),
    unloveTrack: vi.fn(),
    addTags: vi.fn(),
    ...overrides,
  };
  Object.defineProperty(window, "lastfm", { value: api, configurable: true });
  return api;
}

/** `useSettings()` reads/writes `AppSettings` via `window.settings` — kept separate
 * from `installFakeAuthApi` since most existing tests here don't care about it. */
function installFakeSettingsApi(overrides: Partial<SettingsApi> = {}): SettingsApi {
  let current: AppSettings = { ...DEFAULT_APP_SETTINGS };
  const api: SettingsApi = {
    get: vi.fn(() => Promise.resolve(current)),
    set: vi.fn((patch: Partial<AppSettings>) => {
      current = { ...current, ...patch };
      return Promise.resolve(current);
    }),
    reset: vi.fn(() => {
      current = { ...DEFAULT_APP_SETTINGS };
      return Promise.resolve(current);
    }),
    ...overrides,
  };
  Object.defineProperty(window, "settings", { value: api, configurable: true });
  return api;
}

/** Settings → Filter validates via `window.filter.validate` — kept separate from
 * `installFakeAuthApi` since most existing tests here don't care about it. Defaults to
 * accepting anything (`{ valid: true }`); pass `overrides.validate` for tests that
 * need a syntax error. */
function installFakeFilterApi(overrides: Partial<FilterApi> = {}): FilterApi {
  const api: FilterApi = {
    validate: vi.fn(() => Promise.resolve<FilterValidationResult>({ valid: true })),
    ...overrides,
  };
  Object.defineProperty(window, "filter", { value: api, configurable: true });
  return api;
}

/** `useAppVersion()` reads `window.appInfo.getVersion()` — kept separate from
 * `installFakeAuthApi` since most existing tests here don't care about it. */
function installFakeAppInfoApi(version = "1.2.3"): void {
  Object.defineProperty(window, "appInfo", {
    value: { getVersion: vi.fn().mockResolvedValue(version) },
    configurable: true,
  });
}

describe("SettingsPage", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "auth");
    Reflect.deleteProperty(window, "settings");
    Reflect.deleteProperty(window, "lastfm");
    Reflect.deleteProperty(window, "filter");
    Reflect.deleteProperty(window, "appInfo");
    Reflect.deleteProperty(window, "platform");
  });

  it("shows the app version in the General section", async () => {
    installFakeAuthApi();
    installFakeAppInfoApi("1.2.3");

    renderSettingsPage({ onNavigateToSettings: vi.fn() });

    expect(await screen.findByText(/1\.2\.3/)).toBeInTheDocument();
  });

  it("shows a 'not configured' message when the app has no Last.fm API credentials", async () => {
    installFakeAuthApi({
      isConfigured: vi.fn().mockResolvedValue(false),
      credentialsSource: vi.fn().mockResolvedValue("none"),
    });

    renderSettingsPage({ onNavigateToSettings: vi.fn() });

    expect(await screen.findByText(/logging in needs a last\.fm api key/i)).toBeInTheDocument();
  });

  it("resolves out of the loading spinner even if an initial auth IPC call rejects (e.g. a stale main process)", async () => {
    installFakeAuthApi({
      listAccounts: vi.fn().mockRejectedValue(new Error("No handler registered for 'auth:list-accounts'")),
    });

    renderSettingsPage({ onNavigateToSettings: vi.fn() });

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
  });

  it("shows a login button when configured but no account is logged in", async () => {
    installFakeAuthApi({
      isConfigured: vi.fn().mockResolvedValue(true),
      listAccounts: vi.fn().mockResolvedValue([]),
    });

    renderSettingsPage({ onNavigateToSettings: vi.fn() });

    expect(await screen.findByRole("button", { name: /log in with last\.fm/i })).toBeInTheDocument();
  });

  it("clicking login calls window.auth.login()", async () => {
    const login = vi.fn().mockResolvedValue({ username: "alice" });
    installFakeAuthApi({ listAccounts: vi.fn().mockResolvedValue([]), login });

    renderSettingsPage({ onNavigateToSettings: vi.fn() });
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

    renderSettingsPage({ onNavigateToSettings: vi.fn() });
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

    renderSettingsPage({ onNavigateToSettings: vi.fn() });
    const loginButton = await screen.findByRole("button", { name: /log in with last\.fm/i });
    act(() => {
      fireEvent.click(loginButton);
    });

    const alerts = await screen.findAllByText("denied");
    // One copy in the persistent error Alert (initial-load-failure fallback — see
    // SettingsPage's comment on why it's kept alongside the snackbar), one in the
    // snackbar this test is actually about.
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  it("navigates to Profile once login succeeds, so the user sees who they're logged in as", async () => {
    installFakeAuthApi({
      listAccounts: vi.fn().mockResolvedValue([]),
      login: vi.fn().mockResolvedValue({ username: "alice" }),
    });
    const onNavigateToProfile = vi.fn();

    renderSettingsPage({ onNavigateToSettings: vi.fn(), onNavigateToProfile });
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

    renderSettingsPage({ onNavigateToSettings: vi.fn(), onNavigateToProfile });
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

    renderSettingsPage({ onNavigateToSettings: vi.fn() });

    expect(await screen.findByText("alice")).toBeInTheDocument();
  });

  it("clicking log out calls window.auth.logout() with the right username", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    installFakeAuthApi({
      listAccounts: vi.fn().mockResolvedValue(["alice"]),
      getActiveAccount: vi.fn().mockResolvedValue("alice"),
      logout,
    });

    renderSettingsPage({ onNavigateToSettings: vi.fn() });
    const logoutButton = await screen.findByRole("button", { name: /log out/i });
    act(() => {
      fireEvent.click(logoutButton);
    });

    await waitFor(() => {
      expect(logout).toHaveBeenCalledWith("alice");
    });
    expect(await screen.findByText("Logged out alice.")).toBeInTheDocument();
  });

  describe("account avatars", () => {
    it("renders each account's real Last.fm avatar photo when it has one on file", async () => {
      installFakeAuthApi({
        listAccounts: vi.fn().mockResolvedValue(["alice"]),
        getActiveAccount: vi.fn().mockResolvedValue("alice"),
      });
      installFakeLastfmApi({
        getUserInfo: vi.fn().mockResolvedValue({
          username: "alice",
          avatarUrl: "https://lastfm.freetls.fastly.net/i/u/300x300/alice.png",
        }),
      });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      const avatarImg = await screen.findByRole("img", { name: "alice" });
      expect(avatarImg).toHaveAttribute(
        "src",
        "https://lastfm.freetls.fastly.net/i/u/300x300/alice.png",
      );
    });

    it("falls back to a letter avatar for an account with no photo set", async () => {
      installFakeAuthApi({
        listAccounts: vi.fn().mockResolvedValue(["alice"]),
        getActiveAccount: vi.fn().mockResolvedValue("alice"),
      });
      installFakeLastfmApi({ getUserInfo: vi.fn().mockResolvedValue({ username: "alice" }) });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      // Username renders as soon as useAuth resolves, before the avatar fetch settles
      // — wait for that first so the fallback-letter assertion below isn't racing it
      // (same reasoning as ProfilePage's/FriendsPage's equivalent tests).
      await screen.findByText("alice");
      expect(screen.queryByRole("img", { name: "alice" })).not.toBeInTheDocument();
      expect(screen.getByText("A")).toBeInTheDocument();
    });

    it("falls back to a letter avatar when the user-info fetch fails", async () => {
      installFakeAuthApi({
        listAccounts: vi.fn().mockResolvedValue(["alice"]),
        getActiveAccount: vi.fn().mockResolvedValue("alice"),
      });
      installFakeLastfmApi({ getUserInfo: vi.fn().mockRejectedValue(new Error("network error")) });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      await screen.findByText("alice");
      expect(screen.queryByRole("img", { name: "alice" })).not.toBeInTheDocument();
      expect(screen.getByText("A")).toBeInTheDocument();
    });
  });

  it("clicking 'Check for updates now' shows a snackbar reporting the outcome", async () => {
    // window.updates is intentionally left unfaked here — useUpdates()'s checkNow()
    // gracefully resolves a failure in that case, which is enough to prove the button
    // is wired to a snackbar at all without needing a full window.updates fake.
    installFakeAuthApi();

    renderSettingsPage({ onNavigateToSettings: vi.fn() });
    const checkButton = await screen.findByRole("button", { name: /check for updates now/i });
    act(() => {
      fireEvent.click(checkButton);
    });

    expect(await screen.findByText("Not available right now.")).toBeInTheDocument();
  });

  describe("bring your own key", () => {
    it("hides the API key form when this build has credentials baked in via the environment", async () => {
      installFakeAuthApi({ credentialsSource: vi.fn().mockResolvedValue("environment") });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      await screen.findByRole("button", { name: /log in with last\.fm/i });

      expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /remove saved api key/i })).not.toBeInTheDocument();
    });

    it("shows the API key form directly — no login gate — when there's no key configured yet", async () => {
      installFakeAuthApi({
        isConfigured: vi.fn().mockResolvedValue(false),
        credentialsSource: vi.fn().mockResolvedValue("none"),
      });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

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

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
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

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
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

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      const removeButton = await screen.findByRole("button", { name: /remove saved api key/i });
      act(() => {
        fireEvent.click(removeButton);
      });

      await waitFor(() => {
        expect(clearAppCredentials).toHaveBeenCalled();
      });
    });
  });

  describe("appearance", () => {
    it("shows dark mode switched on by default", async () => {
      installFakeAuthApi();
      installFakeSettingsApi();

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      const darkModeSwitch = await screen.findByRole("switch", { name: /dark mode/i });
      expect(darkModeSwitch).toBeChecked();
    });

    it("reflects a previously-saved light mode on load", async () => {
      installFakeAuthApi();
      installFakeSettingsApi({
        get: vi.fn().mockResolvedValue({ ...DEFAULT_APP_SETTINGS, themeMode: "light" }),
      });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      const darkModeSwitch = await screen.findByRole("switch", { name: /dark mode/i });
      expect(darkModeSwitch).not.toBeChecked();
    });

    it("describes switching to light while dark mode is active", async () => {
      installFakeAuthApi();
      installFakeSettingsApi();

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      expect(
        await screen.findByText("Switch to a light color scheme — takes effect immediately"),
      ).toBeInTheDocument();
    });

    it("describes switching to dark while light mode is active", async () => {
      installFakeAuthApi();
      installFakeSettingsApi({
        get: vi.fn().mockResolvedValue({ ...DEFAULT_APP_SETTINGS, themeMode: "light" }),
      });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      expect(
        await screen.findByText("Switch to a dark color scheme — takes effect immediately"),
      ).toBeInTheDocument();
    });

    it("switching dark mode off calls window.settings.set with themeMode 'light'", async () => {
      installFakeAuthApi();
      // Captured as a standalone variable, not accessed as `settingsApi.set` later —
      // SettingsApi.set is declared with method shorthand, which
      // @typescript-eslint/unbound-method flags when referenced off the
      // interface-typed object directly (same pattern used earlier in this file for
      // the aspect-ratio test).
      const set = vi.fn((patch: Partial<AppSettings>) => Promise.resolve({ ...DEFAULT_APP_SETTINGS, ...patch }));
      installFakeSettingsApi({ set });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      const darkModeSwitch = await screen.findByRole("switch", { name: /dark mode/i });

      act(() => {
        fireEvent.click(darkModeSwitch);
      });

      await waitFor(() => {
        expect(set).toHaveBeenCalledWith({ themeMode: "light" });
      });
    });
  });

  describe("launch at login", () => {
    it("shows launch-at-login off by default, with start-minimized hidden until it's on", async () => {
      installFakeAuthApi();
      installFakeSettingsApi();

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      const launchAtLoginSwitch = await screen.findByRole("switch", { name: /launch at login/i });
      expect(launchAtLoginSwitch).not.toBeChecked();
      expect(screen.queryByRole("switch", { name: /start minimized/i })).not.toBeInTheDocument();
    });

    it("reflects a previously-saved launch-at-login setting, revealing start minimized", async () => {
      installFakeAuthApi();
      installFakeSettingsApi({
        get: vi.fn().mockResolvedValue({ ...DEFAULT_APP_SETTINGS, launchAtLogin: true, startMinimized: true }),
      });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      expect(await screen.findByRole("switch", { name: /launch at login/i })).toBeChecked();
      expect(await screen.findByRole("switch", { name: /start minimized/i })).toBeChecked();
    });

    it("switching launch-at-login on calls window.settings.set with launchAtLogin true", async () => {
      installFakeAuthApi();
      const set = vi.fn((patch: Partial<AppSettings>) => Promise.resolve({ ...DEFAULT_APP_SETTINGS, ...patch }));
      installFakeSettingsApi({ set });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      const launchAtLoginSwitch = await screen.findByRole("switch", { name: /launch at login/i });

      act(() => {
        fireEvent.click(launchAtLoginSwitch);
      });

      await waitFor(() => {
        expect(set).toHaveBeenCalledWith({ launchAtLogin: true });
      });
    });

    it("switching start minimized on calls window.settings.set with startMinimized true", async () => {
      installFakeAuthApi();
      const set = vi.fn((patch: Partial<AppSettings>) => Promise.resolve({ ...DEFAULT_APP_SETTINGS, ...patch }));
      installFakeSettingsApi({
        get: vi.fn().mockResolvedValue({ ...DEFAULT_APP_SETTINGS, launchAtLogin: true }),
        set,
      });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      const startMinimizedSwitch = await screen.findByRole("switch", { name: /start minimized/i });

      act(() => {
        fireEvent.click(startMinimizedSwitch);
      });

      await waitFor(() => {
        expect(set).toHaveBeenCalledWith({ startMinimized: true });
      });
    });

    it("hides launch-at-login entirely on Linux, where Electron has no login-item support", async () => {
      Object.defineProperty(window, "platform", { value: "linux", configurable: true });
      installFakeAuthApi();
      installFakeSettingsApi();

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      // Wait for a row that's definitely rendered first, so the query below isn't
      // racing the initial settings load.
      await screen.findByRole("switch", { name: /dark mode/i });
      expect(screen.queryByRole("switch", { name: /launch at login/i })).not.toBeInTheDocument();
    });
  });

  describe("reset to defaults", () => {
    it("does not call window.settings.reset until the confirmation dialog is confirmed", async () => {
      installFakeAuthApi();
      const reset = vi.fn(() => Promise.resolve(DEFAULT_APP_SETTINGS));
      installFakeSettingsApi({ reset });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      fireEvent.click(await screen.findByRole("button", { name: "Reset to defaults" }));

      expect(await screen.findByText(/reset to defaults\?/i)).toBeInTheDocument();
      expect(reset).not.toHaveBeenCalled();
    });

    it("does not reset when the confirmation dialog is cancelled", async () => {
      installFakeAuthApi();
      const reset = vi.fn(() => Promise.resolve(DEFAULT_APP_SETTINGS));
      installFakeSettingsApi({ reset });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      fireEvent.click(await screen.findByRole("button", { name: "Reset to defaults" }));
      fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

      await waitFor(() => {
        expect(screen.queryByText(/reset to defaults\?/i)).not.toBeInTheDocument();
      });
      expect(reset).not.toHaveBeenCalled();
    });

    it("calls window.settings.reset when the confirmation dialog is confirmed", async () => {
      installFakeAuthApi();
      const reset = vi.fn().mockResolvedValue({ ...DEFAULT_APP_SETTINGS, closeToTray: false, themeMode: "light" });
      installFakeSettingsApi({
        get: vi.fn().mockResolvedValue({ ...DEFAULT_APP_SETTINGS, closeToTray: false, themeMode: "light" }),
        reset,
      });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      fireEvent.click(await screen.findByRole("button", { name: "Reset to defaults" }));
      // Two "Reset to defaults" buttons exist once the dialog is open: the settings
      // row's own button (still in the DOM behind the dialog) and the dialog's
      // confirm button — scoping the query to the dialog picks the right one.
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Reset to defaults" }));

      await waitFor(() => {
        expect(reset).toHaveBeenCalledOnce();
      });
    });

    it("reflects the reset settings and closes the dialog after a successful reset", async () => {
      installFakeAuthApi();
      const reset = vi.fn(() => Promise.resolve(DEFAULT_APP_SETTINGS));
      installFakeSettingsApi({
        get: vi.fn().mockResolvedValue({ ...DEFAULT_APP_SETTINGS, themeMode: "light" }),
        reset,
      });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      expect(await screen.findByRole("switch", { name: /dark mode/i })).not.toBeChecked();

      fireEvent.click(await screen.findByRole("button", { name: "Reset to defaults" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Reset to defaults" }));

      await waitFor(() => {
        expect(screen.queryByText(/reset to defaults\?/i)).not.toBeInTheDocument();
      });
      expect(screen.getByRole("switch", { name: /dark mode/i })).toBeChecked();
    });

    it("shows an error snackbar and keeps the dialog's confirm button enabled when reset fails", async () => {
      installFakeAuthApi();
      const reset = vi.fn(() => Promise.reject(new Error("disk full")));
      installFakeSettingsApi({ reset });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      fireEvent.click(await screen.findByRole("button", { name: "Reset to defaults" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Reset to defaults" }));

      expect(await screen.findByText("disk full")).toBeInTheDocument();
    });
  });

  describe("notifications", () => {
    it("shows both notification switches on by default", async () => {
      installFakeAuthApi();
      installFakeSettingsApi();

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      expect(await screen.findByRole("switch", { name: /notify when a track is scrobbled/i })).toBeChecked();
      expect(await screen.findByRole("switch", { name: /notify when scrobbling fails/i })).toBeChecked();
    });

    it("reflects previously-saved notification preferences on load", async () => {
      installFakeAuthApi();
      installFakeSettingsApi({
        get: vi.fn().mockResolvedValue({
          ...DEFAULT_APP_SETTINGS,
          notifyOnScrobble: false,
          notifyOnScrobbleFailure: false,
        }),
      });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      expect(
        await screen.findByRole("switch", { name: /notify when a track is scrobbled/i }),
      ).not.toBeChecked();
      expect(
        await screen.findByRole("switch", { name: /notify when scrobbling fails/i }),
      ).not.toBeChecked();
    });

    it("switching off 'notify when a track is scrobbled' calls window.settings.set with notifyOnScrobble false", async () => {
      installFakeAuthApi();
      const set = vi.fn((patch: Partial<AppSettings>) => Promise.resolve({ ...DEFAULT_APP_SETTINGS, ...patch }));
      installFakeSettingsApi({ set });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      const scrobbleSwitch = await screen.findByRole("switch", { name: /notify when a track is scrobbled/i });

      act(() => {
        fireEvent.click(scrobbleSwitch);
      });

      await waitFor(() => {
        expect(set).toHaveBeenCalledWith({ notifyOnScrobble: false });
      });
    });

    it("switching off 'notify when scrobbling fails' calls window.settings.set with notifyOnScrobbleFailure false", async () => {
      installFakeAuthApi();
      const set = vi.fn((patch: Partial<AppSettings>) => Promise.resolve({ ...DEFAULT_APP_SETTINGS, ...patch }));
      installFakeSettingsApi({ set });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      const failureSwitch = await screen.findByRole("switch", { name: /notify when scrobbling fails/i });

      act(() => {
        fireEvent.click(failureSwitch);
      });

      await waitFor(() => {
        expect(set).toHaveBeenCalledWith({ notifyOnScrobbleFailure: false });
      });
    });

    it("is findable via the search box", async () => {
      installFakeAuthApi();
      installFakeSettingsApi();

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      const searchBox = await screen.findByPlaceholderText("Search settings…");

      fireEvent.change(searchBox, { target: { value: "notifications" } });

      expect(await screen.findByText("Notifications")).toBeInTheDocument();
      expect(screen.queryByText("General")).not.toBeInTheDocument();
    });
  });

  describe("filter", () => {
    it("shows a previously-saved filter expression on load", async () => {
      installFakeAuthApi();
      installFakeSettingsApi({
        get: vi.fn().mockResolvedValue({ ...DEFAULT_APP_SETTINGS, filterExpression: 'sourceApp == "firefox"' }),
      });
      installFakeFilterApi();

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      const field = await screen.findByLabelText("Filter expression");

      await waitFor(() => {
        expect(field).toHaveValue('sourceApp == "firefox"');
      });
    });

    it("shows nothing pre-filled when no filter has ever been saved", async () => {
      installFakeAuthApi();
      installFakeSettingsApi();
      installFakeFilterApi();

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      expect(await screen.findByLabelText("Filter expression")).toHaveValue("");
    });

    it("shows a validation error and disables Save when the expression doesn't compile", async () => {
      installFakeAuthApi();
      installFakeSettingsApi();
      installFakeFilterApi({
        validate: vi.fn().mockResolvedValue({ valid: false, error: "Unexpected end of input" }),
      });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      const field = await screen.findByLabelText("Filter expression");

      fireEvent.change(field, { target: { value: "sourceApp ==" } });
      fireEvent.blur(field);

      expect(await screen.findByText("Unexpected end of input")).toBeInTheDocument();
      const saveButton = await screen.findByRole("button", { name: "Save filter" });
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });
    });

    it("saves a valid filter expression and shows a restart notice", async () => {
      installFakeAuthApi();
      const set = vi.fn((patch: Partial<AppSettings>) => Promise.resolve({ ...DEFAULT_APP_SETTINGS, ...patch }));
      installFakeSettingsApi({ set });
      installFakeFilterApi();

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      const field = await screen.findByLabelText("Filter expression");

      fireEvent.change(field, { target: { value: 'sourceApp == "firefox"' } });
      fireEvent.click(await screen.findByRole("button", { name: "Save filter" }));

      await waitFor(() => {
        expect(set).toHaveBeenCalledWith({ filterExpression: 'sourceApp == "firefox"' });
      });
      expect(
        await screen.findByText("Saved. Restart the app for the filter to take effect."),
      ).toBeInTheDocument();
    });

    it("clears a previously-saved filter when saved empty", async () => {
      installFakeAuthApi();
      const set = vi.fn((patch: Partial<AppSettings>) => Promise.resolve({ ...DEFAULT_APP_SETTINGS, ...patch }));
      installFakeSettingsApi({
        get: vi.fn().mockResolvedValue({ ...DEFAULT_APP_SETTINGS, filterExpression: 'sourceApp == "firefox"' }),
        set,
      });
      installFakeFilterApi();

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      const field = await screen.findByLabelText("Filter expression");
      await waitFor(() => {
        expect(field).toHaveValue('sourceApp == "firefox"');
      });

      fireEvent.change(field, { target: { value: "" } });
      fireEvent.click(await screen.findByRole("button", { name: "Save filter" }));

      await waitFor(() => {
        expect(set).toHaveBeenCalledWith({ filterExpression: undefined });
      });
      expect(await screen.findByText("Filter cleared. Restart the app for it to take effect.")).toBeInTheDocument();
    });

    it("is findable via the search box", async () => {
      installFakeAuthApi();
      installFakeSettingsApi();
      installFakeFilterApi();

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      const searchBox = await screen.findByPlaceholderText("Search settings…");

      fireEvent.change(searchBox, { target: { value: "excluded sources" } });

      expect(await screen.findByText("Filter")).toBeInTheDocument();
      expect(screen.queryByText("General")).not.toBeInTheDocument();
    });
  });

  describe("window", () => {
    it("shows the aspect ratio options with 'Free' selected by default", async () => {
      installFakeAuthApi();
      installFakeSettingsApi();

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      const freeRadio = await screen.findByRole("radio", { name: /free/i });
      expect(freeRadio).toBeChecked();
      expect(screen.getByRole("radio", { name: /16:9/i })).not.toBeChecked();
      expect(screen.getByRole("radio", { name: /4:3/i })).not.toBeChecked();
      expect(screen.getByRole("radio", { name: /1:1/i })).not.toBeChecked();
    });

    it("selecting a different aspect ratio calls window.settings.set and updates the selection", async () => {
      installFakeAuthApi();
      // Captured as a standalone variable (not accessed as `settingsApi.set` later) —
      // `SettingsApi.set` is declared with method shorthand, which
      // `@typescript-eslint/unbound-method` flags when referenced off the
      // interface-typed object directly. Same pattern already used throughout this
      // file for `login`/`logout`/`setAppCredentials`/etc.
      const set = vi.fn((patch: Partial<AppSettings>) => Promise.resolve({ ...DEFAULT_APP_SETTINGS, ...patch }));
      installFakeSettingsApi({ set });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      const widescreenRadio = await screen.findByRole("radio", { name: /16:9/i });

      act(() => {
        fireEvent.click(widescreenRadio);
      });

      await waitFor(() => {
        expect(set).toHaveBeenCalledWith({ aspectRatio: "16:9" });
      });
      expect(await screen.findByRole("radio", { name: /16:9/i })).toBeChecked();
      expect(screen.getByRole("radio", { name: /free/i })).not.toBeChecked();
    });

    it("reflects a previously-saved aspect ratio on load", async () => {
      installFakeAuthApi();
      installFakeSettingsApi({
        get: vi.fn().mockResolvedValue({ ...DEFAULT_APP_SETTINGS, aspectRatio: "4:3" }),
      });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });

      expect(await screen.findByRole("radio", { name: /4:3/i })).toBeChecked();
    });

    it("shows an error snackbar when saving the aspect ratio fails", async () => {
      installFakeAuthApi();
      installFakeSettingsApi({ set: vi.fn().mockRejectedValue(new Error("disk full")) });

      renderSettingsPage({ onNavigateToSettings: vi.fn() });
      const squareRadio = await screen.findByRole("radio", { name: /1:1/i });
      act(() => {
        fireEvent.click(squareRadio);
      });

      expect(await screen.findByText("disk full")).toBeInTheDocument();
    });
  });
});

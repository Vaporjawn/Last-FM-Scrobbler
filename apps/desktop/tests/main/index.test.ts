// @vitest-environment node
/**
 * Tests for `src/main/index.ts`, the Electron main-process entry point. The entry point
 * only composes other modules, so every collaborator is replaced with a recording fake
 * and each test boots the real entry module against a chosen scenario, then drives the
 * callbacks it handed to those collaborators.
 */
import type * as NodeFs from "node:fs";
import { join } from "node:path";
import type * as CoreModule from "@lastfm-scrobbler/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Callback = (...args: unknown[]) => unknown;
type Options = Record<string, unknown>;

const m = vi.hoisted(() => {
  const fn = () => vi.fn();
  const appHandlers: Record<string, Callback> = {};
  interface DockMock {
    setIcon: ReturnType<typeof vi.fn>;
  }
  /** Widens a value to "possibly missing" so tests can later remove it. */
  const maybe = <T>(value: T | undefined): T | undefined => value;
  const dock = maybe<DockMock>({ setIcon: fn() });
  return {
    appHandlers,
    loadEnvFile: fn(),
    existsSync: fn(),
    app: {
      isPackaged: false,
      dock,
      whenReady: fn(),
      getAppPath: fn(),
      getPath: fn(),
      getVersion: fn(),
      getLoginItemSettings: fn(),
      relaunch: fn(),
      exit: fn(),
      quit: fn(),
      on: fn(),
    },
    BrowserWindow: { getAllWindows: fn() },
    shell: { openExternal: fn() },
    screen: { getDisplayMatching: fn() },
    safeStorage: { tag: "safeStorage" },
    wireAppInfo: fn(),
    applyDockIconVisibility: fn(),
    createMainWindow: fn(),
    createPlatformPlaybackSource: fn(),
    createAppCredentialsStore: fn(),
    resolveLastfmCredentials: fn(),
    wireLastfmData: fn(),
    wireTrackActions: fn(),
    wireArtistImage: fn(),
    createAccountStore: fn(),
    wireFilterValidation: fn(),
    wireNetworkStatus: fn(),
    wireAuth: fn(),
    buildLibrefmClient: fn(),
    wireSecondaryAuth: fn(),
    resolveLibrefmCredentials: fn(),
    applyLoginItemSettings: fn(),
    wireScrobbling: fn(),
    wireBugReport: fn(),
    createSettingsStore: fn(),
    wireSettings: fn(),
    showNotification: fn(),
    resolveAppIconPath: fn(),
    resolveExpectedRendererOrigin: fn(),
    createTray: fn(),
    createTrayPopoverWindow: fn(),
    resolveTrayIconPath: fn(),
    wireCloseToTray: fn(),
    createUpdaterClient: fn(),
    showRestartPrompt: fn(),
    wireUpdates: fn(),
    applyAspectRatio: fn(),
    bringAppToForeground: fn(),
    persistWindowBounds: fn(),
    resolveAspectRatioValue: fn(),
    resolveStartHidden: fn(),
    compileFilter: fn(),
    isLikelyNonMusicVideo: fn(),
    compileFilterFailure: undefined as Error | undefined,
    lastfmClients: [] as unknown[],
    listenBrainzClients: [] as unknown[],
    queues: [] as unknown[],
    monitors: [] as unknown[],
  };
});

vi.mock("electron", () => ({
  default: {
    app: m.app,
    BrowserWindow: m.BrowserWindow,
    safeStorage: m.safeStorage,
    screen: m.screen,
    shell: m.shell,
  },
}));
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof NodeFs>()),
  existsSync: m.existsSync,
}));
vi.mock("@lastfm-scrobbler/core", async (importOriginal) => {
  const actual = await importOriginal<typeof CoreModule>();
  m.compileFilter.mockImplementation((expression: string) => {
    if (m.compileFilterFailure) {
      throw m.compileFilterFailure;
    }
    return actual.compileFilter(expression);
  });
  return {
    ...actual,
    compileFilter: m.compileFilter,
    isLikelyNonMusicVideo: m.isLikelyNonMusicVideo,
    LastfmClient: class {
      constructor(readonly options: unknown) {
        m.lastfmClients.push(this);
      }
    },
    ListenBrainzClient: class {
      constructor(readonly options: unknown) {
        m.listenBrainzClients.push(this);
      }
    },
    ScrobbleQueue: class {
      constructor(readonly options: unknown) {
        m.queues.push(this);
      }
    },
    NetworkStatusMonitor: class {
      constructor(readonly options: unknown) {
        m.monitors.push(this);
      }
    },
  };
});
vi.mock("../../src/main/app-info/wire-app-info.js", () => ({ wireAppInfo: m.wireAppInfo }));
vi.mock("../../src/main/dock/apply-dock-icon-visibility.js", () => ({
  applyDockIconVisibility: m.applyDockIconVisibility,
}));
vi.mock("../../src/main/create-main-window.js", () => ({
  createMainWindow: m.createMainWindow,
  MIN_WINDOW_WIDTH: 640,
  MIN_WINDOW_HEIGHT: 480,
}));
vi.mock("../../src/main/playback/create-platform-playback-source.js", () => ({
  createPlatformPlaybackSource: m.createPlatformPlaybackSource,
}));
vi.mock("../../src/main/lastfm/create-app-credentials-store.js", () => ({
  createAppCredentialsStore: m.createAppCredentialsStore,
}));
vi.mock("../../src/main/lastfm/resolve-lastfm-credentials.js", () => ({
  resolveLastfmCredentials: m.resolveLastfmCredentials,
}));
vi.mock("../../src/main/lastfm/wire-lastfm-data.js", () => ({ wireLastfmData: m.wireLastfmData }));
vi.mock("../../src/main/lastfm/wire-track-actions.js", () => ({
  wireTrackActions: m.wireTrackActions,
}));
vi.mock("../../src/main/artist-images/wire-artist-image.js", () => ({
  wireArtistImage: m.wireArtistImage,
}));
vi.mock("../../src/main/auth/create-account-store.js", () => ({
  createAccountStore: m.createAccountStore,
}));
vi.mock("../../src/main/filters/wire-filter-validation.js", () => ({
  wireFilterValidation: m.wireFilterValidation,
}));
vi.mock("../../src/main/network/wire-network-status.js", () => ({
  wireNetworkStatus: m.wireNetworkStatus,
}));
vi.mock("../../src/main/auth/wire-auth.js", () => ({ wireAuth: m.wireAuth }));
vi.mock("../../src/main/auth/build-librefm-client.js", () => ({
  buildLibrefmClient: m.buildLibrefmClient,
}));
vi.mock("../../src/main/auth/wire-secondary-auth.js", () => ({
  wireSecondaryAuth: m.wireSecondaryAuth,
}));
vi.mock("../../src/main/auth/resolve-librefm-credentials.js", () => ({
  resolveLibrefmCredentials: m.resolveLibrefmCredentials,
}));
vi.mock("../../src/main/login-items/apply-login-item-settings.js", () => ({
  applyLoginItemSettings: m.applyLoginItemSettings,
}));
vi.mock("../../src/main/scrobbling/wire-scrobbling.js", () => ({
  wireScrobbling: m.wireScrobbling,
}));
vi.mock("../../src/main/bug-report/wire-bug-report.js", () => ({
  wireBugReport: m.wireBugReport,
}));
vi.mock("../../src/main/settings/settings-store.js", () => ({
  createSettingsStore: m.createSettingsStore,
}));
vi.mock("../../src/main/settings/wire-settings.js", () => ({ wireSettings: m.wireSettings }));
vi.mock("../../src/main/notifications/show-notification.js", () => ({
  showNotification: m.showNotification,
}));
vi.mock("../../src/main/resolve-app-icon-path.js", () => ({
  resolveAppIconPath: m.resolveAppIconPath,
}));
vi.mock("../../src/main/resolve-expected-renderer-origin.js", () => ({
  resolveExpectedRendererOrigin: m.resolveExpectedRendererOrigin,
}));
vi.mock("../../src/main/tray/create-tray.js", () => ({ createTray: m.createTray }));
vi.mock("../../src/main/tray/create-tray-popover-window.js", () => ({
  createTrayPopoverWindow: m.createTrayPopoverWindow,
}));
vi.mock("../../src/main/tray/resolve-tray-icon-path.js", () => ({
  resolveTrayIconPath: m.resolveTrayIconPath,
}));
vi.mock("../../src/main/tray/wire-close-to-tray.js", () => ({
  wireCloseToTray: m.wireCloseToTray,
}));
vi.mock("../../src/main/updates/create-updater-client.js", () => ({
  createUpdaterClient: m.createUpdaterClient,
}));
vi.mock("../../src/main/updates/show-restart-prompt.js", () => ({
  showRestartPrompt: m.showRestartPrompt,
}));
vi.mock("../../src/main/updates/wire-updates.js", () => ({ wireUpdates: m.wireUpdates }));
vi.mock("../../src/main/window/apply-aspect-ratio.js", () => ({
  applyAspectRatio: m.applyAspectRatio,
}));
vi.mock("../../src/main/window/bring-app-to-foreground.js", () => ({
  bringAppToForeground: m.bringAppToForeground,
}));
vi.mock("../../src/main/window/persist-window-bounds.js", () => ({
  persistWindowBounds: m.persistWindowBounds,
}));
vi.mock("../../src/main/window/resolve-aspect-ratio.js", () => ({
  resolveAspectRatioValue: m.resolveAspectRatioValue,
}));
vi.mock("../../src/main/window/resolve-start-hidden.js", () => ({
  resolveStartHidden: m.resolveStartHidden,
}));

interface FakeWindow {
  readonly on: ReturnType<typeof vi.fn>;
  readonly once: ReturnType<typeof vi.fn>;
  readonly show: ReturnType<typeof vi.fn>;
  readonly focus: ReturnType<typeof vi.fn>;
  readonly getBounds: ReturnType<typeof vi.fn>;
  readonly isDestroyed: ReturnType<typeof vi.fn>;
}

function createFakeWindow(): FakeWindow {
  return {
    on: vi.fn(),
    once: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    getBounds: vi.fn().mockReturnValue({ x: 1, y: 2, width: 300, height: 200 }),
    isDestroyed: vi.fn().mockReturnValue(false),
  };
}

interface Scenario {
  readonly isPackaged?: boolean;
  readonly platform?: NodeJS.Platform;
  readonly envFileExists?: boolean;
  readonly dock?: boolean;
  readonly settings?: Options;
  /** [Last.fm, Libre.fm, ListenBrainz] account stores, in createAccountStore call order. */
  readonly accountStores?: readonly [unknown, unknown, unknown];
  readonly appCredentialsStore?: unknown;
  readonly credentials?: { apiKey: string; apiSecret: string; source: string } | undefined;
  readonly appIconPath?: string | undefined;
  readonly wasOpenedAtLogin?: boolean;
  readonly startHidden?: boolean;
  readonly compileFilterError?: Error;
}

const SECURE_STORES = [
  { name: "lastfm-accounts" },
  { name: "librefm-accounts" },
  { name: "listenbrainz-accounts" },
] as const;

/** The settings every scenario starts from; scenarios override individual keys. */
const DEFAULT_SETTINGS: Options = {
  launchAtLogin: false,
  showDockIcon: true,
  startMinimized: false,
  showTrayIcon: true,
  notifyOnScrobble: true,
  notifyOnScrobbleFailure: true,
  scrobblingEnabled: true,
  hasShownTrayHint: false,
  autoUpdateEnabled: true,
  aspectRatio: "16:9",
  themeMode: "dark",
  filterExpression: undefined,
  skipNonMusicVideos: false,
  windowBounds: undefined,
};

interface Booted {
  readonly settings: Options;
  readonly settingsSet: ReturnType<typeof vi.fn>;
  readonly windows: FakeWindow[];
  readonly logLines: string[];
  readonly tray: { destroy: ReturnType<typeof vi.fn> };
  readonly gated: { onScrobbleEligible: Callback; onTrackChanged: Callback };
}

const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
const originalLoadEnvFile: unknown = Reflect.get(process, "loadEnvFile");

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

/** Boots the real entry point against `scenario` and waits for `whenReady` work to finish. */
async function boot(scenario: Scenario = {}): Promise<Booted> {
  vi.resetModules();
  for (const key of Object.keys(m.appHandlers)) {
    Reflect.deleteProperty(m.appHandlers, key);
  }
  m.lastfmClients.length = 0;
  m.listenBrainzClients.length = 0;
  m.queues.length = 0;
  m.monitors.length = 0;
  vi.clearAllMocks();

  setPlatform(scenario.platform ?? "linux");
  process.loadEnvFile = m.loadEnvFile;
  const logLines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    logLines.push(String(line));
  });

  const settings: Options = { ...DEFAULT_SETTINGS, ...scenario.settings };
  const settingsSet = vi.fn((patch: Options) => {
    Object.assign(settings, patch);
  });
  m.createSettingsStore.mockReturnValue({ get: () => settings, set: settingsSet });

  m.app.isPackaged = scenario.isPackaged ?? false;
  m.app.dock = scenario.dock === false ? undefined : { setIcon: vi.fn() };
  m.app.whenReady.mockReturnValue(Promise.resolve());
  m.app.getAppPath.mockReturnValue("/app");
  m.app.getPath.mockReturnValue("/user-data");
  m.app.getVersion.mockReturnValue("9.9.9");
  m.app.getLoginItemSettings.mockReturnValue({
    wasOpenedAtLogin: scenario.wasOpenedAtLogin ?? false,
  });
  m.app.on.mockImplementation((event: string, handler: Callback) => {
    m.appHandlers[event] = handler;
  });
  m.existsSync.mockReturnValue(scenario.envFileExists ?? false);
  m.BrowserWindow.getAllWindows.mockReturnValue([]);
  m.screen.getDisplayMatching.mockReturnValue({ workArea: { width: 1920, height: 1080 } });

  const stores = scenario.accountStores ?? SECURE_STORES;
  const storeQueue = [...stores];
  m.createAccountStore.mockImplementation(() => storeQueue.shift());
  m.createAppCredentialsStore.mockReturnValue(
    "appCredentialsStore" in scenario ? scenario.appCredentialsStore : { name: "app-credentials" },
  );
  m.resolveLastfmCredentials.mockResolvedValue(
    "credentials" in scenario
      ? scenario.credentials
      : { apiKey: "key", apiSecret: "secret", source: "environment" },
  );
  m.resolveLibrefmCredentials.mockResolvedValue({ apiKey: "lk", apiSecret: "ls" });
  m.buildLibrefmClient.mockReturnValue({ tag: "librefm-client" });
  m.resolveExpectedRendererOrigin.mockReturnValue("app://renderer");
  m.resolveAppIconPath.mockReturnValue(
    "appIconPath" in scenario ? scenario.appIconPath : "/app/resources/icon.png",
  );
  m.resolveTrayIconPath.mockReturnValue("/app/resources/tray.png");
  m.resolveAspectRatioValue.mockReturnValue(1.5);
  m.resolveStartHidden.mockReturnValue(scenario.startHidden ?? false);
  m.compileFilterFailure = scenario.compileFilterError;
  m.isLikelyNonMusicVideo.mockReturnValue(true);
  m.createPlatformPlaybackSource.mockReturnValue({ tag: "playback-source" });
  m.createTrayPopoverWindow.mockReturnValue({ tag: "popover" });
  const tray = { destroy: vi.fn() };
  m.createTray.mockReturnValue(tray);
  m.createUpdaterClient.mockReturnValue({ tag: "updater" });
  const networkHandle = { syncTrayTooltip: vi.fn() };
  m.wireNetworkStatus.mockReturnValue(networkHandle);
  const gated = {
    onScrobbleEligible: vi.fn(),
    onTrackChanged: vi.fn(),
  };
  m.wireScrobbling.mockReturnValue(gated);

  const windows: FakeWindow[] = [];
  m.createMainWindow.mockImplementation(() => {
    const window = createFakeWindow();
    windows.push(window);
    return window;
  });
  m.persistWindowBounds.mockReturnValue(vi.fn());

  await import("../../src/main/index.js");
  await flush();

  return {
    settings,
    settingsSet,
    windows,
    logLines,
    tray,
    gated: gated as unknown as Booted["gated"],
  };
}

function optionsOf(mock: ReturnType<typeof vi.fn>, callIndex = 0): Options {
  return (mock.mock.calls[callIndex] as [Options])[0];
}

function callbackOf(options: Options, name: string): Callback {
  return options[name] as Callback;
}

afterEach(() => {
  if (originalPlatform) {
    Object.defineProperty(process, "platform", originalPlatform);
  }
  Reflect.set(process, "loadEnvFile", originalLoadEnvFile);
  vi.restoreAllMocks();
});

describe("main process entry point", () => {
  describe("startup", () => {
    beforeEach(() => {
      vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    it("loads a local .env file in development and sets the macOS dock icon", async () => {
      await boot({ platform: "darwin", envFileExists: true });

      expect(m.loadEnvFile).toHaveBeenCalledWith(join("/app", ".env"));
      expect(m.app.dock?.setIcon).toHaveBeenCalledWith("/app/resources/icon.png");
    });

    it("skips the .env file when it does not exist and the dock icon off macOS", async () => {
      await boot({ platform: "linux", envFileExists: false });

      expect(m.loadEnvFile).not.toHaveBeenCalled();
      expect(m.app.dock?.setIcon).not.toHaveBeenCalled();
    });

    it("tolerates a missing dock (macOS without a dock API) and a missing dev icon", async () => {
      await boot({ platform: "darwin", dock: false, appIconPath: undefined });

      const createOptions = optionsOf(m.createMainWindow);
      expect(createOptions).not.toHaveProperty("iconPath");
    });

    it("does not read a .env file or look up an icon in a packaged build", async () => {
      await boot({ isPackaged: true, platform: "darwin", envFileExists: true });

      expect(m.loadEnvFile).not.toHaveBeenCalled();
      expect(m.resolveAppIconPath).not.toHaveBeenCalled();
      expect(optionsOf(m.createMainWindow)).not.toHaveProperty("iconPath");
      const login = optionsOf(m.wireAuth);
      callbackOf(login, "onLoginFailed")("nope");
      expect(optionsOf(m.showNotification)).not.toHaveProperty("icon");
    });

    it("applies the persisted login-item and dock settings once at startup", async () => {
      await boot({ settings: { launchAtLogin: true, showDockIcon: false } });

      expect(m.applyLoginItemSettings).toHaveBeenCalledWith(m.app, true);
      expect(m.applyDockIconVisibility).toHaveBeenCalledWith(m.app, false);
    });

    it("forwards playback-source warnings to the logger", async () => {
      const { logLines } = await boot();
      const report = m.createPlatformPlaybackSource.mock.calls[0]?.[0] as Callback;

      report("adapter construction failed");

      expect(logLines).toContain("adapter construction failed");
    });

    it("warns about missing secure storage and disables scrobbling wiring", async () => {
      const { logLines } = await boot({
        accountStores: [undefined, undefined, undefined],
        appCredentialsStore: undefined,
      });

      expect(logLines).toContain("Secure account storage unavailable this run — login disabled.");
      expect(logLines).toContain(
        "Secure storage unavailable this run — bring-your-own-key is disabled.",
      );
      expect(m.queues).toHaveLength(0);
      expect(m.wireScrobbling).not.toHaveBeenCalled();
      expect(optionsOf(m.wireAuth)).not.toHaveProperty("networkStatus");
      expect(optionsOf(m.wireLastfmData)).not.toHaveProperty("networkStatus");
      expect(optionsOf(m.wireTrackActions)).not.toHaveProperty("networkStatus");
      expect(optionsOf(m.createMainWindow)).not.toHaveProperty("onScrobbleEligible");
      expect(optionsOf(m.createMainWindow)).not.toHaveProperty("onTrackChanged");
      expect(m.wireNetworkStatus).not.toHaveBeenCalled();
    });

    it("runs without Last.fm credentials: no client, a warning, and Last.fm-less scrobbling", async () => {
      const { logLines } = await boot({ credentials: undefined });

      expect(logLines).toContain(
        "Last.fm API credentials not configured this run — login disabled.",
      );
      expect(m.lastfmClients).toHaveLength(0);
      expect(optionsOf(m.wireArtistImage)).not.toHaveProperty("lastfmClient");
      expect(optionsOf(m.wireTrackActions).createSessionClient).toBeUndefined();
      const scrobbling = optionsOf(m.wireScrobbling);
      expect(scrobbling).not.toHaveProperty("accountStore");
      expect(scrobbling).not.toHaveProperty("createSessionClient");
      expect(optionsOf(m.wireAuth).credentialsSource).toBeUndefined();
    });

    it("builds Last.fm clients from the resolved credentials, including per-session ones", async () => {
      await boot();

      expect(m.lastfmClients).toHaveLength(1);
      expect(m.lastfmClients[0]).toMatchObject({
        options: { apiKey: "key", apiSecret: "secret" },
      });
      expect(optionsOf(m.wireArtistImage)).toHaveProperty("lastfmClient");
      const createSessionClient = optionsOf(m.wireTrackActions).createSessionClient as (
        sessionKey: string,
      ) => unknown;
      createSessionClient("sk-1");
      expect(m.lastfmClients[1]).toMatchObject({
        options: { apiKey: "key", apiSecret: "secret", sessionKey: "sk-1" },
      });
      expect(optionsOf(m.wireAuth).credentialsSource).toBe("environment");
      expect(optionsOf(m.wireScrobbling)).toHaveProperty("accountStore");
      expect(m.wireFilterValidation).toHaveBeenCalledTimes(1);
    });

    it("hands the shared network monitor to the Last.fm wiring when secure storage exists", async () => {
      await boot();

      const monitor = m.monitors[0];
      expect(monitor).toBeDefined();
      expect(optionsOf(m.wireAuth).networkStatus).toBe(monitor);
      expect(optionsOf(m.wireLastfmData).networkStatus).toBe(monitor);
      expect(optionsOf(m.wireTrackActions).networkStatus).toBe(monitor);
    });
  });

  describe("login wiring", () => {
    beforeEach(() => {
      vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    it("opens only safe URLs in the browser, for both Last.fm and Libre.fm", async () => {
      await boot();

      for (const options of [optionsOf(m.wireAuth), optionsOf(m.wireSecondaryAuth)]) {
        m.shell.openExternal.mockClear();
        callbackOf(options, "openUrl")("javascript:alert(1)");
        expect(m.shell.openExternal).not.toHaveBeenCalled();
        callbackOf(options, "openUrl")("https://www.last.fm/api/auth?token=abc");
        expect(m.shell.openExternal).toHaveBeenCalledWith("https://www.last.fm/api/auth?token=abc");
      }
    });

    it("relaunches the app and marks it as quitting so the window really closes", async () => {
      const { tray } = await boot();

      callbackOf(optionsOf(m.wireAuth), "relaunch")();

      expect(m.app.relaunch).toHaveBeenCalledTimes(1);
      expect(m.app.exit).toHaveBeenCalledWith(0);
      const close = optionsOf(m.wireCloseToTray);
      expect((close.isQuitting as Callback)()).toBe(true);
      expect(tray.destroy).not.toHaveBeenCalled();
    });

    it("brings the app forward and notifies after a Last.fm login", async () => {
      const { logLines } = await boot();
      const window = createFakeWindow();
      m.BrowserWindow.getAllWindows.mockReturnValue([window]);

      callbackOf(optionsOf(m.wireAuth), "onLoginSuccess")("victor");

      expect(logLines).toContain("Login succeeded (victor) — bringing the app to the foreground.");
      expect(m.bringAppToForeground).toHaveBeenCalledWith(m.app, window);
      const notification = optionsOf(m.showNotification);
      expect(notification).toMatchObject({
        title: "Logged in",
        body: "You're now logged in to Last.fm Scrobbler as victor.",
        icon: "/app/resources/icon.png",
      });
      m.bringAppToForeground.mockClear();
      callbackOf(notification, "onClick")();
      expect(m.bringAppToForeground).toHaveBeenCalledWith(m.app, window);
      m.bringAppToForeground.mockClear();
      m.BrowserWindow.getAllWindows.mockReturnValue([]);
      callbackOf(notification, "onClick")();
      expect(m.bringAppToForeground).not.toHaveBeenCalled();
    });

    it("warns when a Last.fm login succeeds but no window exists", async () => {
      const { logLines } = await boot();

      callbackOf(optionsOf(m.wireAuth), "onLoginSuccess")("victor");

      expect(logLines).toContain("Login succeeded but no window exists to bring forward.");
      expect(m.bringAppToForeground).not.toHaveBeenCalled();
    });

    it("notifies about a failed Last.fm login", async () => {
      const { logLines } = await boot();

      callbackOf(optionsOf(m.wireAuth), "onLoginFailed")("timed out");

      expect(logLines).toContain("Login failed — timed out");
      expect(optionsOf(m.showNotification)).toMatchObject({
        title: "Login failed",
        body: "timed out",
      });
    });

    it("brings the app forward and notifies after a Libre.fm login", async () => {
      const { logLines } = await boot();
      const window = createFakeWindow();
      m.BrowserWindow.getAllWindows.mockReturnValue([window]);

      callbackOf(optionsOf(m.wireSecondaryAuth), "onLibrefmLoginSuccess")("victor");

      expect(logLines).toContain(
        "Libre.fm login succeeded (victor) — bringing the app to the foreground.",
      );
      expect(m.bringAppToForeground).toHaveBeenCalledWith(m.app, window);
      const notification = optionsOf(m.showNotification);
      expect(notification).toMatchObject({ title: "Logged in to Libre.fm" });
      m.bringAppToForeground.mockClear();
      callbackOf(notification, "onClick")();
      expect(m.bringAppToForeground).toHaveBeenCalledWith(m.app, window);
      m.bringAppToForeground.mockClear();
      m.BrowserWindow.getAllWindows.mockReturnValue([]);
      callbackOf(notification, "onClick")();
      expect(m.bringAppToForeground).not.toHaveBeenCalled();
    });

    it("warns when a Libre.fm login succeeds but no window exists", async () => {
      const { logLines } = await boot();

      callbackOf(optionsOf(m.wireSecondaryAuth), "onLibrefmLoginSuccess")("victor");

      expect(logLines).toContain("Libre.fm login succeeded but no window exists to bring forward.");
    });

    it("notifies about a failed Libre.fm login", async () => {
      const { logLines } = await boot();

      callbackOf(optionsOf(m.wireSecondaryAuth), "onLibrefmLoginFailed")("denied");

      expect(logLines).toContain("Libre.fm login failed — denied");
      expect(optionsOf(m.showNotification)).toMatchObject({
        title: "Libre.fm login failed",
        body: "denied",
      });
    });

    it("resolves Libre.fm app credentials fresh on every call", async () => {
      await boot();
      const resolve = optionsOf(m.wireSecondaryAuth).resolveLibrefmCredentials as Callback;

      await expect(resolve()).resolves.toEqual({ apiKey: "lk", apiSecret: "ls" });
      expect(m.resolveLibrefmCredentials).toHaveBeenCalledWith({
        librefmAppCredentialsStore: { name: "app-credentials" },
      });
    });
  });

  describe("scrobbling wiring", () => {
    beforeEach(() => {
      vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    function services(): { id: string; getClient: () => Promise<unknown> }[] {
      return optionsOf(m.wireScrobbling).additionalServices as {
        id: string;
        getClient: () => Promise<unknown>;
      }[];
    }

    it("builds a Libre.fm client from the active account and app credentials", async () => {
      await boot();
      const librefm = services().find((service) => service.id === "librefm");
      const store = SECURE_STORES[1] as { name: string } & Record<string, unknown>;
      store.getActiveAccount = vi.fn().mockResolvedValue({ sessionKey: "lsk" });

      await expect(librefm?.getClient()).resolves.toEqual({ tag: "librefm-client" });
      expect(m.buildLibrefmClient).toHaveBeenCalledWith(
        { apiKey: "lk", apiSecret: "ls" },
        { sessionKey: "lsk" },
      );
    });

    it("has no Libre.fm client without a store, an active account, or credentials", async () => {
      await boot({ accountStores: [SECURE_STORES[0], undefined, SECURE_STORES[2]] });
      await expect(
        services()
          .find((service) => service.id === "librefm")
          ?.getClient(),
      ).resolves.toBeUndefined();

      const librefmStore = { getActiveAccount: vi.fn().mockResolvedValue(undefined) };
      await boot({ accountStores: [SECURE_STORES[0], librefmStore, SECURE_STORES[2]] });
      await expect(
        services()
          .find((service) => service.id === "librefm")
          ?.getClient(),
      ).resolves.toBeUndefined();

      librefmStore.getActiveAccount.mockResolvedValue({ sessionKey: "lsk" });
      await boot({ accountStores: [SECURE_STORES[0], librefmStore, SECURE_STORES[2]] });
      m.resolveLibrefmCredentials.mockResolvedValue(undefined);
      await expect(
        services()
          .find((service) => service.id === "librefm")
          ?.getClient(),
      ).resolves.toBeUndefined();
    });

    it("builds a ListenBrainz client only when an account is connected", async () => {
      const listenbrainzStore = {
        getActiveAccount: vi.fn().mockResolvedValue({ sessionKey: "t" }),
      };
      await boot({ accountStores: [SECURE_STORES[0], SECURE_STORES[1], listenbrainzStore] });
      const getClient = () =>
        services()
          .find((service) => service.id === "listenbrainz")
          ?.getClient();

      const client = await getClient();
      expect(client).toBe(m.listenBrainzClients[0]);
      expect(m.listenBrainzClients[0]).toMatchObject({ options: { token: "t" } });

      listenbrainzStore.getActiveAccount.mockImplementation(() => Promise.resolve(undefined));
      await expect(getClient()).resolves.toBeUndefined();
    });

    it("has no ListenBrainz client at all when its store is unavailable", async () => {
      await boot({ accountStores: [SECURE_STORES[0], SECURE_STORES[1], undefined] });

      await expect(
        services()
          .find((service) => service.id === "listenbrainz")
          ?.getClient(),
      ).resolves.toBeUndefined();
    });

    it("notifies about scrobbles only when enabled, summarising batches", async () => {
      const { settings } = await boot();
      const onScrobbled = optionsOf(m.wireScrobbling).onScrobbled as Callback;

      onScrobbled([{ track: "Idioteque", artist: "Radiohead" }]);
      expect(optionsOf(m.showNotification)).toMatchObject({
        title: "Scrobbled",
        body: "Idioteque — Radiohead",
      });

      onScrobbled([
        { track: "Idioteque", artist: "Radiohead" },
        { track: "Nude", artist: "Radiohead" },
      ]);
      expect(optionsOf(m.showNotification, 1)).toMatchObject({
        body: "Idioteque — Radiohead and 1 more",
      });

      m.showNotification.mockClear();
      onScrobbled([]);
      expect(m.showNotification).not.toHaveBeenCalled();

      settings.notifyOnScrobble = false;
      onScrobbled([{ track: "Idioteque", artist: "Radiohead" }]);
      expect(m.showNotification).not.toHaveBeenCalled();
    });

    it("notifies about scrobble failures only when enabled", async () => {
      const { settings } = await boot();
      const onScrobbleFailed = optionsOf(m.wireScrobbling).onScrobbleFailed as Callback;

      onScrobbleFailed("offline");
      expect(optionsOf(m.showNotification)).toMatchObject({
        body: "offline — will keep retrying in the background.",
      });

      m.showNotification.mockClear();
      settings.notifyOnScrobbleFailure = false;
      onScrobbleFailed("offline");
      expect(m.showNotification).not.toHaveBeenCalled();
    });

    it("gates scrobbling and now-playing updates on the live scrobblingEnabled setting", async () => {
      const { settings, gated } = await boot();
      const createOptions = optionsOf(m.createMainWindow);
      const eligible = createOptions.onScrobbleEligible as Callback;
      const trackChanged = createOptions.onTrackChanged as Callback;

      eligible({ id: 1 });
      trackChanged({ id: 2 });
      expect(gated.onScrobbleEligible).toHaveBeenCalledWith({ id: 1 });
      expect(gated.onTrackChanged).toHaveBeenCalledWith({ id: 2 });

      settings.scrobblingEnabled = false;
      (gated.onScrobbleEligible as unknown as ReturnType<typeof vi.fn>).mockClear();
      (gated.onTrackChanged as unknown as ReturnType<typeof vi.fn>).mockClear();
      eligible({ id: 3 });
      trackChanged({ id: 4 });
      expect(gated.onScrobbleEligible).not.toHaveBeenCalled();
      expect(gated.onTrackChanged).not.toHaveBeenCalled();
    });
  });

  describe("main window", () => {
    beforeEach(() => {
      vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    it("creates the first window from the persisted settings", async () => {
      const bounds = { x: 5, y: 6, width: 700, height: 500 };
      await boot({ settings: { windowBounds: bounds, themeMode: "light" } });

      expect(optionsOf(m.createMainWindow)).toMatchObject({
        playbackSource: { tag: "playback-source" },
        iconPath: "/app/resources/icon.png",
        initialBounds: bounds,
        initialAspectRatio: 1.5,
        initialThemeMode: "light",
      });
      expect(optionsOf(m.createMainWindow)).not.toHaveProperty("startHidden");
      expect(optionsOf(m.createMainWindow)).not.toHaveProperty("filter");
    });

    it("starts the first window hidden only when the start-hidden policy says so", async () => {
      await boot({
        settings: { startMinimized: true },
        wasOpenedAtLogin: true,
        startHidden: true,
      });

      expect(m.resolveStartHidden).toHaveBeenCalledWith(true, true);
      expect(optionsOf(m.createMainWindow)).toMatchObject({ startHidden: true });
    });

    it("compiles a valid filter expression and applies it to tracks", async () => {
      await boot({ settings: { filterExpression: 'artist == "Radiohead"' } });

      const { filter } = optionsOf(m.createMainWindow) as {
        filter: { test: (track: unknown) => boolean };
      };
      expect(m.compileFilter).toHaveBeenCalledWith('artist == "Radiohead"');
      expect(filter.test({ artist: "Radiohead", title: "x" })).toBe(true);
      expect(filter.test({ artist: "Other", title: "x" })).toBe(false);
    });

    it("ignores and logs an invalid filter expression", async () => {
      const { logLines } = await boot({ settings: { filterExpression: "((((" } });

      expect(
        logLines.some((line) => line.startsWith("Settings → Filter: invalid expression")),
      ).toBe(true);
      expect(optionsOf(m.createMainWindow)).not.toHaveProperty("filter");
    });

    it("logs a non-syntax failure while compiling a filter expression", async () => {
      const { logLines } = await boot({
        settings: { filterExpression: "anything" },
        compileFilterError: new Error("boom"),
      });

      expect(logLines.some((line) => line.includes("Error: boom"))).toBe(true);
      expect(optionsOf(m.createMainWindow)).not.toHaveProperty("filter");
    });

    it("excludes non-music videos when that setting is on", async () => {
      await boot({ settings: { skipNonMusicVideos: true } });

      const { filter } = optionsOf(m.createMainWindow) as {
        filter: { test: (track: unknown) => boolean };
      };
      expect(filter.test({ title: "Long video" })).toBe(true);
      expect(m.isLikelyNonMusicVideo).toHaveBeenCalledWith({ title: "Long video" });
    });

    it("hides to the tray, persists bounds, and cleans up when the window closes", async () => {
      const { windows } = await boot();
      const [window] = windows as [FakeWindow];

      const close = optionsOf(m.wireCloseToTray);
      expect(close.window).toBe(window);
      expect((close.isQuitting as Callback)()).toBe(false);

      const persist = optionsOf(m.persistWindowBounds);
      const tracked = persist.window as {
        onResize: Callback;
        onMove: Callback;
        getBounds: Callback;
        isDestroyed: Callback;
      };
      const listener = vi.fn();
      tracked.onResize(listener);
      tracked.onMove(listener);
      expect(window.on).toHaveBeenCalledWith("resize", listener);
      expect(window.on).toHaveBeenCalledWith("move", listener);
      expect(tracked.getBounds()).toEqual({ x: 1, y: 2, width: 300, height: 200 });
      expect(tracked.isDestroyed()).toBe(false);
      const stop = m.persistWindowBounds.mock.results[0]?.value as ReturnType<typeof vi.fn>;
      expect(window.once).toHaveBeenCalledWith("closed", stop);
    });

    it("explains the tray only the first time the window is hidden (menu bar on macOS)", async () => {
      const { settingsSet } = await boot({ platform: "darwin" });
      const onHide = optionsOf(m.wireCloseToTray).onHide as Callback;

      onHide();
      expect(settingsSet).toHaveBeenCalledWith({ hasShownTrayHint: true });
      expect(optionsOf(m.showNotification)).toMatchObject({ title: "Still running" });
      expect((optionsOf(m.showNotification).body as string).includes("menu bar")).toBe(true);

      m.showNotification.mockClear();
      onHide();
      expect(m.showNotification).not.toHaveBeenCalled();
    });

    it("calls it the tray on other platforms, and stays silent if already shown", async () => {
      await boot({ platform: "linux" });
      (optionsOf(m.wireCloseToTray).onHide as Callback)();
      expect((optionsOf(m.showNotification).body as string).includes("tray")).toBe(true);
      expect((optionsOf(m.showNotification).body as string).includes("menu bar")).toBe(false);

      await boot({ settings: { hasShownTrayHint: true } });
      (optionsOf(m.wireCloseToTray).onHide as Callback)();
      expect(m.showNotification).not.toHaveBeenCalled();
    });
  });

  describe("windows, settings and updates", () => {
    beforeEach(() => {
      vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    it("exposes the live main window and tray to the network-status wiring", async () => {
      const { windows, tray } = await boot();
      const options = optionsOf(m.wireNetworkStatus);

      expect(options.monitor).toBe(m.monitors[0]);
      expect((options.getMainWindow as Callback)()).toBe(windows[0]);
      expect((options.getTray as Callback)()).toBe(tray);
      expect(
        (
          m.wireNetworkStatus.mock.results[0]?.value as {
            syncTrayTooltip: ReturnType<typeof vi.fn>;
          }
        ).syncTrayTooltip,
      ).toHaveBeenCalledTimes(1);
    });

    it("reports the app version and can show the main window on request", async () => {
      const { windows } = await boot();
      const options = optionsOf(m.wireAppInfo);

      expect((options.getVersion as Callback)()).toBe("9.9.9");
      (options.onShowMainWindow as Callback)();

      expect(windows[0]?.show).toHaveBeenCalled();
      expect(windows[0]?.focus).toHaveBeenCalled();
    });

    it("applies settings changes to the live window and the OS", async () => {
      const { windows } = await boot();
      const options = optionsOf(m.wireSettings);

      (options.onAspectRatioChange as Callback)("4:3");
      expect(m.screen.getDisplayMatching).toHaveBeenCalledWith({
        x: 1,
        y: 2,
        width: 300,
        height: 200,
      });
      expect(m.applyAspectRatio).toHaveBeenCalledWith(windows[0], "4:3", {
        minWidth: 640,
        minHeight: 480,
        availableWidth: 1920,
        availableHeight: 1080,
      });

      m.applyLoginItemSettings.mockClear();
      (options.onLaunchAtLoginChange as Callback)(true);
      expect(m.applyLoginItemSettings).toHaveBeenCalledWith(m.app, true);

      m.applyDockIconVisibility.mockClear();
      (options.onShowDockIconChange as Callback)(false);
      expect(m.applyDockIconVisibility).toHaveBeenCalledWith(m.app, false);
    });

    it("wires auto-updates against the live window and settings", async () => {
      const { windows, settings } = await boot();
      const options = optionsOf(m.wireUpdates);

      expect(options.client).toEqual({ tag: "updater" });
      expect((options.getMainWindow as Callback)()).toBe(windows[0]);
      expect((options.isAutoCheckEnabled as Callback)()).toBe(true);
      settings.autoUpdateEnabled = false;
      expect((options.isAutoCheckEnabled as Callback)()).toBe(false);

      (options.promptToRestart as Callback)("2.0.0");
      expect(m.showRestartPrompt).toHaveBeenCalledWith(windows[0], "2.0.0");

      (options.onUpdateAvailable as Callback)("2.0.0");
      expect(optionsOf(m.showNotification)).toMatchObject({
        title: "Update available",
        body: "Downloading Last.fm Scrobbler 2.0.0 in the background…",
      });
      (options.onUpdateCheckFailed as Callback)("no network");
      expect(optionsOf(m.showNotification, 1)).toMatchObject({
        title: "Couldn't check for updates",
        body: "no network",
      });
    });

    it("sends bug-report diagnostics with the platform, version and recent logs", async () => {
      await boot({ platform: "linux" });
      const options = optionsOf(m.wireBugReport);

      expect(options.expectedOrigin).toBe("app://renderer");
      const diagnostics = (options.getDiagnostics as Callback)() as Record<string, unknown>;
      expect(diagnostics).toMatchObject({ platform: "linux", appVersion: "9.9.9" });
      expect(typeof diagnostics.recentLogs).toBe("string");
    });
  });

  describe("tray and lifecycle", () => {
    beforeEach(() => {
      vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    it("creates the tray with a popover and lets it show the window or quit", async () => {
      const { windows } = await boot();
      const options = optionsOf(m.createTray);

      expect(options).toMatchObject({
        iconPath: "/app/resources/tray.png",
        popover: { tag: "popover" },
      });
      (options.onShow as Callback)();
      expect(windows[0]?.show).toHaveBeenCalled();
      expect(windows[0]?.focus).toHaveBeenCalled();

      (options.onQuit as Callback)();
      expect(m.app.quit).toHaveBeenCalledTimes(1);
      expect((optionsOf(m.wireCloseToTray).isQuitting as Callback)()).toBe(true);
    });

    it("creates no tray or popover when the tray icon is turned off", async () => {
      await boot({ settings: { showTrayIcon: false } });

      expect(m.createTrayPopoverWindow).not.toHaveBeenCalled();
      expect(m.createTray).not.toHaveBeenCalled();
      expect(
        (
          m.wireNetworkStatus.mock.results[0]?.value as {
            syncTrayTooltip: ReturnType<typeof vi.fn>;
          }
        ).syncTrayTooltip,
      ).not.toHaveBeenCalled();
    });

    it("tolerates a build with no network monitor when creating the tray", async () => {
      await boot({ accountStores: [undefined, undefined, undefined] });

      expect(m.createTray).toHaveBeenCalledTimes(1);
    });

    it("destroys the tray and marks the app as quitting before quit", async () => {
      const { tray } = await boot();

      m.appHandlers["before-quit"]?.();

      expect(tray.destroy).toHaveBeenCalledTimes(1);
      expect((optionsOf(m.wireCloseToTray).isQuitting as Callback)()).toBe(true);
    });

    it("quits cleanly even when there is no tray to destroy", async () => {
      await boot({ settings: { showTrayIcon: false } });

      expect(() => m.appHandlers["before-quit"]?.()).not.toThrow();
    });

    it("recreates the main window on activate when none are open", async () => {
      const { windows } = await boot();
      m.BrowserWindow.getAllWindows.mockReturnValue([]);

      m.appHandlers.activate?.();

      expect(m.createMainWindow).toHaveBeenCalledTimes(2);
      expect(windows).toHaveLength(2);
      // The replacement becomes the live window for everything that reads it later.
      (optionsOf(m.wireAppInfo).onShowMainWindow as Callback)();
      expect(windows[1]?.show).toHaveBeenCalled();
      expect(optionsOf(m.createMainWindow, 1)).not.toHaveProperty("startHidden");
    });

    it("brings the existing window back on activate when one is already open", async () => {
      const { windows } = await boot();
      m.BrowserWindow.getAllWindows.mockReturnValue([windows[0]]);

      m.appHandlers.activate?.();

      expect(m.createMainWindow).toHaveBeenCalledTimes(1);
      expect(windows[0]?.show).toHaveBeenCalled();
      expect(windows[0]?.focus).toHaveBeenCalled();
    });

    it("quits when all windows close, except on macOS", async () => {
      await boot({ platform: "linux" });
      m.appHandlers["window-all-closed"]?.();
      expect(m.app.quit).toHaveBeenCalledTimes(1);

      await boot({ platform: "darwin" });
      m.appHandlers["window-all-closed"]?.();
      expect(m.app.quit).not.toHaveBeenCalled();
    });
  });
});

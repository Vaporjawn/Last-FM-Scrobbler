import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";
import {
  compileFilter,
  FilterSyntaxError,
  LastfmClient,
  ListenBrainzClient,
  Logger,
  ScrobbleQueue,
  type CompiledFilter,
} from "@lastfm-scrobbler/core";
import { wireAppInfo } from "./app-info/wire-app-info.js";
import { applyDockIconVisibility } from "./dock/apply-dock-icon-visibility.js";
import {
  createMainWindow,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  type CreateMainWindowOptions,
} from "./create-main-window.js";
import { createPlatformPlaybackSource } from "./playback/create-platform-playback-source.js";
import { createAppCredentialsStore } from "./lastfm/create-app-credentials-store.js";
import { resolveLastfmCredentials } from "./lastfm/resolve-lastfm-credentials.js";
import { wireLastfmData } from "./lastfm/wire-lastfm-data.js";
import { wireTrackActions } from "./lastfm/wire-track-actions.js";
import { wireArtistImage } from "./artist-images/wire-artist-image.js";
import { createAccountStore } from "./auth/create-account-store.js";
import { wireFilterValidation } from "./filters/wire-filter-validation.js";
import { wireAuth } from "./auth/wire-auth.js";
import { buildLibrefmClient, wireSecondaryAuth } from "./auth/wire-secondary-auth.js";
import { applyLoginItemSettings } from "./login-items/apply-login-item-settings.js";
import { wireScrobbling } from "./scrobbling/wire-scrobbling.js";
import { wireBugReport } from "./bug-report/wire-bug-report.js";
import { createSettingsStore } from "./settings/settings-store.js";
import { wireSettings } from "./settings/wire-settings.js";
import { showNotification } from "./notifications/show-notification.js";
import { resolveAppIconPath } from "./resolve-app-icon-path.js";
import { resolveExpectedRendererOrigin } from "./resolve-expected-renderer-origin.js";
import { createTray } from "./tray/create-tray.js";
import { createTrayPopoverWindow, resolvePopoverScreenBounds } from "./tray/create-tray-popover-window.js";
import { resolveTrayIconPath } from "./tray/resolve-tray-icon-path.js";
import { wireCloseToTray } from "./tray/wire-close-to-tray.js";
import { createUpdaterClient } from "./updates/create-updater-client.js";
import { showRestartPrompt } from "./updates/show-restart-prompt.js";
import { wireUpdates } from "./updates/wire-updates.js";
import { bringAppToForeground } from "./window/bring-app-to-foreground.js";
import { computePortraitWindowSize } from "./window/compute-portrait-window-size.js";
import { computeResizedHeight } from "./window/compute-resized-height.js";
import { persistWindowBounds } from "./window/persist-window-bounds.js";
import { resolveAspectRatioValue } from "./window/resolve-aspect-ratio.js";
import { resolveStartHidden } from "./window/resolve-start-hidden.js";

// Electron's main-process module is CJS with a non-standard export shape that Node's
// static ESM/CJS interop can't always detect named exports from (some properties are
// defined in a way `cjs-module-lexer` misses) — importing the default and destructuring
// at runtime sidesteps that entirely. See docs/modules/desktop.md for the exact error
// this fixes if reverted.
const { app, BrowserWindow, safeStorage, shell } = electron;

// Mirrors create-main-window.ts's own `dirname` — both files live in `src/main/`, so
// the same "one level up into renderer/" relative resolution
// `resolveExpectedRendererOrigin` does lands on the exact same file `createMainWindow`
// itself loads via `loadFile`. Computed once at module scope (matching
// create-main-window.ts's own `dirname` — this doesn't change over the app's
// lifetime) and passed to `wireAuth`/`wireTrackActions` below so their handlers can
// verify a call's `senderFrame` genuinely is this app's own renderer, not some other
// page (see validate-ipc-sender.ts).
const dirname = fileURLToPath(new URL(".", import.meta.url));
const expectedRendererOrigin = resolveExpectedRendererOrigin(
  dirname,
  process.env.ELECTRON_RENDERER_URL,
);

// Bounded ring buffer of recent log lines, attached to bug reports as diagnostics (see
// wireBugReport below) — never logs credentials (session keys, API secrets), only
// operational messages like "adapter construction failed" or "relay returned 502".
const logger = new Logger({
  level: "basic",
  sink: (entry) => {
    console.log(entry.message);
  },
});

/**
 * Compiles `AppSettings.filterExpression` for `Tracker` — `undefined` for no
 * filtering, whether because the setting itself is unset or because it failed to
 * compile. An invalid expression is logged as a warning rather than crashing the
 * tracker or blocking startup — Settings → Filter validates before saving (see
 * `main/filters/wire-filter-validation.ts`), but this is the last line of defense
 * against a value edited by hand in settings.json outside the app.
 */
function compileFilterExpression(expression: string | undefined): CompiledFilter | undefined {
  if (!expression) {
    return undefined;
  }
  try {
    return compileFilter(expression);
  } catch (error) {
    const message = error instanceof FilterSyntaxError ? error.message : String(error);
    logger.warn(`Settings → Filter: invalid expression, ignoring it — ${message}`);
    return undefined;
  }
}

// Constructed once at app startup, not per-window: it may spawn a real OS-level
// process (see packages/adapter-macos), and there should only ever be one of those
// per app instance regardless of how many windows come and go.
const playbackSource = createPlatformPlaybackSource((message) => {
  logger.warn(message);
});

// Set right before a *real* quit (the tray's "Quit" item, or `before-quit` from Cmd+Q/
// OS shutdown/etc.) so `wireCloseToTray` lets that close through instead of hiding the
// window again. `tray` is kept at module scope too — Electron's `Tray` is garbage
// collected (and its icon silently disappears) if nothing holds a reference to it.
let isQuitting = false;
let tray: Electron.Tray | undefined;

void app.whenReady().then(async () => {
  // Local dev convenience: a git-ignored `apps/desktop/.env` file (already covered by
  // the repo's root .gitignore) lets LASTFM_API_KEY/LASTFM_API_SECRET/
  // BUG_REPORT_RELAY_URL persist across `npm run dev` launches instead of needing to
  // be re-exported in the shell every time — set them once, they just keep working.
  // Dev only: a packaged build has no reason to read a loose text file for secrets,
  // and `app.getAppPath()` wouldn't point at a useful location for one anyway once
  // packaged (see resolve-app-icon-path.ts's docstring on the same asar distinction).
  // This project still never *generates* or hardcodes a real key anywhere — getting
  // one from Last.fm is still on whoever runs this, same as always (see
  // docs/modules/desktop.md); this only makes *using* one less repetitive once you
  // have it. `process.loadEnvFile` is a built-in Node API (stable since Node
  // 22.21/24.10, available since 20.12) — no new dependency needed for this.
  //
  // Deliberately placed here, inside `whenReady()`, rather than at module top level
  // (its original location, moved as part of the same fix documented in
  // create-updater-client.ts): this project's ESM main-process entry point loads via
  // Node's async ESM entry-point runner, which — verified live, this exact crash —
  // does not guarantee `electron.app`'s properties are populated yet at module
  // top-level evaluation time, only by the time `whenReady()` actually resolves.
  // Every other `app.*` access in this file already correctly waits for this same
  // callback; this one just hadn't been exercised by a genuine cold start before.
  if (!app.isPackaged) {
    const envFilePath = join(app.getAppPath(), ".env");
    if (existsSync(envFilePath)) {
      process.loadEnvFile(envFilePath);
    }
  }

  const userDataDir = app.getPath("userData");

  // Shared by every `resources/`-relative lookup below (tray icon, app icon) — see
  // `resolve-resource-path.ts` for why `appPath` and `resourcesPath` aren't
  // interchangeable once packaged.
  const resourcePathOptions = {
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    isPackaged: app.isPackaged,
  };
  // Only meaningful in dev — see `resolve-app-icon-path.ts`'s docstring. A packaged
  // build's icon comes from `electron-builder.yml` instead.
  const appIconPath = app.isPackaged ? undefined : resolveAppIconPath(resourcePathOptions);
  if (appIconPath && process.platform === "darwin") {
    app.dock?.setIcon(appIconPath);
  }
  // Spread into every `showNotification(...)` call below — `exactOptionalPropertyTypes`
  // means `icon: appIconPath` (possibly `undefined`) isn't assignable to `icon?:
  // string`; omitting the key entirely (this spreads to nothing when `appIconPath` is
  // `undefined`) is what that type actually wants. In a packaged build this is always
  // `{}` — `showNotification` falls back to the OS's own default in that case (the
  // app's bundle icon on a real install), same reasoning as `appIconPath` above.
  const notificationIconOption = appIconPath ? { icon: appIconPath } : {};

  const settingsStore = createSettingsStore({ filePath: join(userDataDir, "settings.json") });

  // Registers (or unregisters) this app as an OS login item to match the persisted
  // setting — see AppSettings.launchAtLogin's docstring for the macOS/Windows-only,
  // Linux-is-a-no-op platform reality this call encodes. Applied once here at startup;
  // wireSettings's onLaunchAtLoginChange below keeps it live-updated after that without
  // needing a restart.
  applyLoginItemSettings(app, settingsStore.get().launchAtLogin);
  // Same "applied once at startup, then kept live" split as launchAtLogin above — see
  // AppSettings.showDockIcon's docstring.
  applyDockIconVisibility(app, settingsStore.get().showDockIcon);

  const accountStore = createAccountStore({
    filePath: join(userDataDir, "secrets.json"),
    safeStorage,
  });
  if (!accountStore) {
    logger.warn("Secure account storage unavailable this run — login disabled.");
  }

  // A separate store/file from accountStore above: this holds a user-supplied
  // *application* credential (bring-your-own-key), not a per-user session key.
  const appCredentialsStore = createAppCredentialsStore({
    filePath: join(userDataDir, "app-credentials.json"),
    safeStorage,
  });
  if (!appCredentialsStore) {
    logger.warn("Secure storage unavailable this run — bring-your-own-key is disabled.");
  }

  // Libre.fm and ListenBrainz — additional scrobbling destinations connected
  // alongside Last.fm, not switched between (see wire-scrobbling.ts's docstring on
  // this app's "submit to all connected services at once" model). Separate
  // secret-storage files from Last.fm's own (secrets.json/app-credentials.json
  // above), via the same createAccountStore/createAppCredentialsStore factories —
  // `undefined` under the exact same condition accountStore/appCredentialsStore are
  // (they all share one `safeStorage`), so no separate warning is logged for these.
  const librefmAccountStore = createAccountStore({
    filePath: join(userDataDir, "librefm-secrets.json"),
    safeStorage,
  });
  const librefmAppCredentialsStore = createAppCredentialsStore({
    filePath: join(userDataDir, "librefm-app-credentials.json"),
    safeStorage,
  });
  const listenbrainzAccountStore = createAccountStore({
    filePath: join(userDataDir, "listenbrainz-secrets.json"),
    safeStorage,
  });

  // LASTFM_API_KEY/LASTFM_API_SECRET (baked into this build) take precedence, falling
  // back to a key the end user saved themselves via Settings → Accounts. undefined
  // when neither is available — the app still launches; login and Last.fm data views
  // just report "not configured". See main/lastfm/resolve-lastfm-credentials.ts.
  const resolvedCredentials = await resolveLastfmCredentials({ appCredentialsStore });
  const lastfmClient = resolvedCredentials
    ? new LastfmClient({
        apiKey: resolvedCredentials.apiKey,
        apiSecret: resolvedCredentials.apiSecret,
      })
    : undefined;
  if (!lastfmClient) {
    logger.warn("Last.fm API credentials not configured this run — login disabled.");
  }

  wireAuth({
    expectedOrigin: expectedRendererOrigin,
    accountStore,
    client: lastfmClient,
    openUrl: (url) => shell.openExternal(url),
    credentialsSource: resolvedCredentials?.source,
    appCredentialsStore,
    relaunch: () => {
      isQuitting = true;
      app.relaunch();
      app.exit(0);
    },
    onLoginSuccess: (username) => {
      // The user was just sent away to their own browser for Last.fm's "Allow
      // Access" step — bring the app back to the front so they land somewhere
      // useful instead of alt-tabbing back to it themselves (SettingsPage's
      // login handler switches the active view to Profile at the same time, so
      // what they see on return is confirmation of who they're now logged in as).
      // Looked up fresh via `getAllWindows()` (same approach as the `activate`
      // handler below) rather than closing over `mainWindow`, since that variable
      // doesn't exist yet at this point in the function.
      logger.info(`Login succeeded (${username}) — bringing the app to the foreground.`);
      const [window] = BrowserWindow.getAllWindows();
      if (window) {
        bringAppToForeground(app, window);
      } else {
        logger.warn("Login succeeded but no window exists to bring forward.");
      }
      // Fires alongside the focus-stealing attempt above, not instead of it — a
      // native OS notification is the one signal in this whole chain that's
      // actually *guaranteed* to appear regardless of focus/Do Not Disturb/window
      // manager quirks (see bring-app-to-foreground.ts's docstring for why the
      // focus calls above can't make that same guarantee). Clicking it re-runs the
      // same foreground logic in case the window still isn't visible.
      showNotification({
        title: "Logged in",
        body: `You're now logged in to Last.fm Scrobbler as ${username}.`,
        ...notificationIconOption,
        onClick: () => {
          const [clickedWindow] = BrowserWindow.getAllWindows();
          if (clickedWindow) {
            bringAppToForeground(app, clickedWindow);
          }
        },
      });
    },
    onLoginFailed: (message) => {
      // Last.fm's own desktop-auth flow has no callback/redirect mechanism at all —
      // their docs say outright that after granting access "the user is asked to
      // close their browser and return to your application" manually. That means a
      // failure here (most often AuthTimeoutError: nobody clicked "Allow Access"
      // within the poll window) can happen long after the user switched away from
      // this app to their browser, with no window visible to show the usual in-app
      // error in. A native notification is the one signal that still reaches them.
      logger.warn(`Login failed — ${message}`);
      showNotification({
        title: "Login failed",
        body: message,
        ...notificationIconOption,
      });
    },
  });
  wireSecondaryAuth({
    expectedOrigin: expectedRendererOrigin,
    librefmAccountStore,
    librefmAppCredentialsStore,
    listenbrainzAccountStore,
    openUrl: (url) => shell.openExternal(url),
    // Same reasoning as wireAuth's onLoginSuccess/onLoginFailed above, just for
    // Libre.fm's own browser-authorization step — see wire-secondary-auth.ts.
    onLibrefmLoginSuccess: (username) => {
      logger.info(`Libre.fm login succeeded (${username}) — bringing the app to the foreground.`);
      const [window] = BrowserWindow.getAllWindows();
      if (window) {
        bringAppToForeground(app, window);
      } else {
        logger.warn("Libre.fm login succeeded but no window exists to bring forward.");
      }
      showNotification({
        title: "Logged in to Libre.fm",
        body: `You're now connected to Libre.fm as ${username}.`,
        ...notificationIconOption,
        onClick: () => {
          const [clickedWindow] = BrowserWindow.getAllWindows();
          if (clickedWindow) {
            bringAppToForeground(app, clickedWindow);
          }
        },
      });
    },
    onLibrefmLoginFailed: (message) => {
      logger.warn(`Libre.fm login failed — ${message}`);
      showNotification({
        title: "Libre.fm login failed",
        body: message,
        ...notificationIconOption,
      });
    },
  });
  wireLastfmData({ client: lastfmClient });
  // Tries Last.fm's own artist photo first when `lastfmClient` is configured (usually
  // a miss — see wire-artist-image.ts's docstring), Deezer's public artist search
  // always as the guaranteed fallback — unlike wireLastfmData above, this still works
  // even in a build with no Last.fm credentials at all, since Deezer needs none.
  wireArtistImage({ ...(lastfmClient ? { lastfmClient } : {}) });
  // Also unconditional — validating a filter expression is pure, local, and needs no
  // Last.fm credentials at all, see wire-filter-validation.ts.
  wireFilterValidation();

  // Shared by scrobble submission and the signed track actions (love/unlove/addTags)
  // below — both need a client signed with a *specific account's* session key, which
  // is only known once a login has happened, unlike `lastfmClient` above (unsigned,
  // used for public reads only).
  const createSessionClient = resolvedCredentials
    ? (sessionKey: string) =>
        new LastfmClient({
          apiKey: resolvedCredentials.apiKey,
          apiSecret: resolvedCredentials.apiSecret,
          sessionKey,
        })
    : undefined;

  wireTrackActions({ expectedOrigin: expectedRendererOrigin, accountStore, createSessionClient });

  let onScrobbleEligible: CreateMainWindowOptions["onScrobbleEligible"];
  let onTrackChanged: CreateMainWindowOptions["onTrackChanged"];
  // Gated on accountStore alone (secure storage being available at all), not also on
  // lastfmClient/createSessionClient — those two require *Last.fm* credentials
  // specifically, but scrobbling should still run when only Libre.fm and/or
  // ListenBrainz end up connected and Last.fm has none configured. accountStore and
  // librefmAccountStore/listenbrainzAccountStore all share one safeStorage instance,
  // so they're either all defined or all undefined together — this one check stands
  // in for "is secure storage available" generally, not just for Last.fm.
  if (accountStore) {
    const scrobbleQueue = new ScrobbleQueue({
      databasePath: join(userDataDir, "scrobble-queue.sqlite3"),
    });
    const scrobbling = wireScrobbling({
      queue: scrobbleQueue,
      ...(lastfmClient && createSessionClient ? { accountStore, createSessionClient } : {}),
      additionalServices: [
        {
          id: "librefm",
          getClient: async () => {
            if (!librefmAccountStore || !librefmAppCredentialsStore) {
              return undefined;
            }
            const active = await librefmAccountStore.getActiveAccount();
            if (!active) {
              return undefined;
            }
            return buildLibrefmClient(librefmAppCredentialsStore, { sessionKey: active.sessionKey });
          },
        },
        {
          id: "listenbrainz",
          getClient: async () => {
            const active = await listenbrainzAccountStore?.getActiveAccount();
            return active ? new ListenBrainzClient({ token: active.sessionKey }) : undefined;
          },
        },
      ],
      onScrobbled: (items) => {
        // Read fresh on every call, not captured once at wiring time — lets toggling
        // Settings → Notifications take effect immediately, no restart needed, same
        // as `handleTrayHide`/`wireUpdates` below already do by reading
        // `settingsStore.get()` at the point each notification actually fires rather
        // than at startup.
        if (!settingsStore.get().notifyOnScrobble) {
          return;
        }
        const [first] = items;
        if (!first) {
          return;
        }
        showNotification({
          title: "Scrobbled",
          body:
            items.length === 1
              ? `${first.track} — ${first.artist}`
              : `${first.track} — ${first.artist} and ${items.length - 1} more`,
          ...notificationIconOption,
        });
      },
      onScrobbleFailed: (reason) => {
        if (!settingsStore.get().notifyOnScrobbleFailure) {
          return;
        }
        showNotification({
          title: "Scrobbling is having trouble reaching your connected services",
          body: `${reason} — will keep retrying in the background.`,
          ...notificationIconOption,
        });
      },
    });
    onScrobbleEligible = scrobbling.onScrobbleEligible;
    // Pushes a real-time "now playing" update to Last.fm on every new track — see
    // wire-scrobbling.ts's ScrobblingHandle.onTrackChanged docstring for why this is
    // separate from onScrobbleEligible above (different timeline, best-effort).
    onTrackChanged = (event) => {
      void scrobbling.onTrackChanged(event);
    };
  }

  wireBugReport({
    relayUrl: process.env.BUG_REPORT_RELAY_URL,
    getDiagnostics: () => ({
      platform: process.platform,
      arch: process.arch,
      appVersion: app.getVersion(),
      recentLogs: logger.formatRecentEntriesAsText(50),
    }),
  });

  // The very first time the window is actually hidden-to-tray (across this install's
  // whole lifetime, not just this run — tracked via `AppSettings.hasShownTrayHint`),
  // explain where it went. Every call after the first is a no-op (the settings write
  // on the first call makes `hasShownTrayHint` true from then on) — this is
  // deliberately *not* re-checked-and-reset anywhere, so it really only ever fires
  // once per install, not once per session.
  function handleTrayHide(): void {
    if (settingsStore.get().hasShownTrayHint) {
      return;
    }
    settingsStore.set({ hasShownTrayHint: true });
    const place = process.platform === "darwin" ? "menu bar" : "tray";
    showNotification({
      title: "Still running",
      body: `Last.fm Scrobbler is still running in the ${place} — scrobbling continues in the background. Quit from there when you're done.`,
      ...notificationIconOption,
    });
  }

  // Consolidates the three calls every new main window needs (create + hide-to-tray +
  // bounds persistence) — used both for the very first window below and for a
  // replacement one in the `activate` handler further down (macOS re-opens the app via
  // the dock after every window has been closed with closeToTray disabled).
  // `startHidden` is only ever passed for the very first window below (resolved from
  // `AppSettings.startMinimized` *and* whether this process launch was actually
  // triggered by the OS login item — see `resolveStartHidden`'s docstring for why a
  // manual launch must never start hidden even with the setting on). The `activate`
  // handler further down calls this with no argument, correctly defaulting to
  // `false` — a dock-icon click while the app has no windows is always a manual,
  // explicit request to see it, never something that should stay hidden.
  function createAndWireMainWindow(windowOptions?: { startHidden?: boolean }): Electron.BrowserWindow {
    const { windowBounds, aspectRatio, filterExpression } = settingsStore.get();
    // Compiled once, here, not live-updated: unlike aspectRatio/themeMode above,
    // `Tracker` (packages/core) has no way to swap its filter after construction, so
    // a filter-expression change only takes effect on the next window this function
    // creates — in practice, an app restart. Settings → Filter tells the user this
    // explicitly when they save a change.
    const filter = compileFilterExpression(filterExpression);
    const window = createMainWindow({
      playbackSource,
      ...(onScrobbleEligible ? { onScrobbleEligible } : {}),
      ...(onTrackChanged ? { onTrackChanged } : {}),
      ...(appIconPath ? { iconPath: appIconPath } : {}),
      ...(windowBounds ? { initialBounds: windowBounds } : {}),
      initialAspectRatio: resolveAspectRatioValue(aspectRatio),
      ...(filter ? { filter } : {}),
      ...(windowOptions?.startHidden ? { startHidden: true } : {}),
    });
    wireCloseToTray({
      window,
      settingsStore,
      isQuitting: () => isQuitting,
      onHide: handleTrayHide,
    });
    persistWindowBounds({
      // Adapts the real `BrowserWindow`'s Node-`EventEmitter`-style `on(event,
      // listener)` to `BoundsTrackedWindow`'s two separate methods — see that
      // interface's docstring for why persist-window-bounds.ts doesn't just take a
      // `BrowserWindow` directly.
      window: {
        onResize: (listener) => {
          window.on("resize", listener);
        },
        onMove: (listener) => {
          window.on("move", listener);
        },
        getBounds: () => window.getBounds(),
        isDestroyed: () => window.isDestroyed(),
      },
      settingsStore,
    });
    return window;
  }

  let mainWindow = createAndWireMainWindow({
    startHidden: resolveStartHidden(
      settingsStore.get().startMinimized,
      app.getLoginItemSettings().wasOpenedAtLogin,
    ),
  });

  wireAppInfo({
    getVersion: () => app.getVersion(),
    // Reads the live `mainWindow` binding, not a stale reference, matching
    // `wireSettings`'s own `onAspectRatioChange` right below — keeps working
    // correctly after the `activate` handler further down replaces it.
    onShowMainWindow: () => {
      mainWindow.show();
      mainWindow.focus();
    },
  });

  wireSettings({
    store: settingsStore,
    // Applies a Settings → Window aspect-ratio change to the already-open window
    // immediately, rather than waiting for the user to restart the app — reads the
    // live `mainWindow` binding below, not a stale reference, so this keeps working
    // correctly after the `activate` handler further down replaces it.
    onAspectRatioChange: (aspectRatio) => {
      const aspectRatioValue = resolveAspectRatioValue(aspectRatio);
      mainWindow.setAspectRatio(aspectRatioValue);
      // setAspectRatio() alone only *constrains future manual resizing* — it doesn't
      // itself resize the window (Electron's own docs: "This will not resize the
      // window"), which without the branches below would make picking a ratio
      // visually do nothing until the user happened to drag an edge, reading as
      // broken even though it already applied. Snaps to the new ratio right now
      // instead — a no-op for both branches when `aspectRatioValue` is 0 ("free"),
      // which correctly leaves the current size alone.
      const bounds = mainWindow.getBounds();
      if (aspectRatioValue > 0 && aspectRatioValue < 1) {
        // Portrait (currently only "9:16" — see AppSettings.aspectRatio's docstring):
        // computePortraitWindowSize anchors differently than the landscape/square
        // branch below, see its own docstring for why.
        const { width, height } = computePortraitWindowSize(
          bounds.width,
          bounds.height,
          aspectRatioValue,
          MIN_WINDOW_WIDTH,
        );
        if (width !== bounds.width || height !== bounds.height) {
          mainWindow.setSize(width, height);
        }
      } else {
        // Landscape or square — keeps the current width fixed and derives height from
        // it (see computeResizedHeight's docstring).
        const resizedHeight = computeResizedHeight(
          bounds.width,
          bounds.height,
          aspectRatioValue,
          MIN_WINDOW_HEIGHT,
        );
        if (resizedHeight !== bounds.height) {
          mainWindow.setSize(bounds.width, resizedHeight);
        }
      }
    },
    // Keeps the OS login-item registration in sync the moment the setting changes,
    // rather than only applying it on the next launch — same live-update reasoning as
    // onAspectRatioChange above.
    onLaunchAtLoginChange: (launchAtLogin) => {
      applyLoginItemSettings(app, launchAtLogin);
    },
    // Same live-update reasoning as onAspectRatioChange/onLaunchAtLoginChange above —
    // see AppSettings.showDockIcon's docstring for why this one (unlike
    // showTrayIcon) is safe to apply immediately with no restart needed.
    onShowDockIconChange: (showDockIcon) => {
      applyDockIconVisibility(app, showDockIcon);
    },
  });

  // Wired once for the app's whole lifetime (not re-wired in "activate" below, unlike
  // wireCloseToTray) — checks/downloads are a per-process concern, not a per-window
  // one, and re-wiring would attach duplicate listeners to the long-lived autoUpdater
  // singleton and restart its check interval. See docs/modules/desktop.md's
  // "Auto-update" section.
  const updaterClient = createUpdaterClient({ logger });
  wireUpdates({
    client: updaterClient,
    mainWindow,
    isAutoCheckEnabled: () => settingsStore.get().autoUpdateEnabled,
    promptToRestart: (version) => showRestartPrompt(mainWindow, version),
    onUpdateAvailable: (version) => {
      showNotification({
        title: "Update available",
        body: `Downloading Last.fm Scrobbler ${version} in the background…`,
        ...notificationIconOption,
      });
    },
    onUpdateCheckFailed: (message) => {
      showNotification({
        title: "Couldn't check for updates",
        body: message,
        ...notificationIconOption,
      });
    },
  });

  // Both skipped entirely when Settings → General's "Show application icon in the
  // tray/menu bar" is off — see AppSettings.showTrayIcon's docstring for why this is
  // applied once here at startup only, not live-toggled the way showDockIcon is.
  // `trayPopover` has no purpose other than being the tray's own popover, so there's
  // nothing to create at all once the tray icon itself isn't going to exist.
  if (settingsStore.get().showTrayIcon) {
    // Created hidden, up front — see create-tray-popover-window.ts. Not tied to
    // mainWindow's own lifecycle (recreated in the "activate" handler below); the
    // popover is cheap to leave alive for the whole app session and doesn't need to be
    // recreated just because the main window was.
    const trayPopover = createTrayPopoverWindow();

    tray = createTray({
      iconPath: resolveTrayIconPath(resourcePathOptions),
      popover: trayPopover,
      resolvePopoverScreenBounds,
      onShow: () => {
        mainWindow.show();
        mainWindow.focus();
      },
      onQuit: () => {
        isQuitting = true;
        app.quit();
      },
    });
  }

  app.on("before-quit", () => {
    isQuitting = true;
    tray?.destroy();
  });

  app.on("activate", () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) {
      mainWindow = createAndWireMainWindow();
      return;
    }
    // A window already exists but may be hidden (closeToTray) — bring it back rather
    // than leaving the dock/taskbar click with no visible effect.
    mainWindow.show();
    mainWindow.focus();
  });
});

app.on("window-all-closed", () => {
  // With closeToTray enabled (the default), closing the window is intercepted before
  // it ever gets here (see wireCloseToTray) — this only fires when the user has
  // disabled that setting and actually closed the window, in which case the normal
  // per-platform quit convention applies.
  if (process.platform !== "darwin") {
    app.quit();
  }
});

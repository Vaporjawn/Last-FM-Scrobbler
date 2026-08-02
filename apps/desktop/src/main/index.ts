import { existsSync } from "node:fs";
import { join } from "node:path";
import electron from "electron";
import { LastfmClient, Logger, ScrobbleQueue } from "@lastfm-scrobbler/core";
import { createMainWindow } from "./create-main-window.js";
import { createPlatformPlaybackSource } from "./playback/create-platform-playback-source.js";
import { createAppCredentialsStore } from "./lastfm/create-app-credentials-store.js";
import { resolveLastfmCredentials } from "./lastfm/resolve-lastfm-credentials.js";
import { wireLastfmData } from "./lastfm/wire-lastfm-data.js";
import { wireTrackActions } from "./lastfm/wire-track-actions.js";
import { createAccountStore } from "./auth/create-account-store.js";
import { wireAuth } from "./auth/wire-auth.js";
import { wireScrobbling } from "./scrobbling/wire-scrobbling.js";
import { wireBugReport } from "./bug-report/wire-bug-report.js";
import { createSettingsStore } from "./settings/settings-store.js";
import { wireSettings } from "./settings/wire-settings.js";
import { showNotification } from "./notifications/show-notification.js";
import { resolveAppIconPath } from "./resolve-app-icon-path.js";
import { createTray } from "./tray/create-tray.js";
import { resolveTrayIconPath } from "./tray/resolve-tray-icon-path.js";
import { wireCloseToTray } from "./tray/wire-close-to-tray.js";
import { createUpdaterClient } from "./updates/create-updater-client.js";
import { showRestartPrompt } from "./updates/show-restart-prompt.js";
import { wireUpdates } from "./updates/wire-updates.js";
import { bringAppToForeground } from "./window/bring-app-to-foreground.js";

// Electron's main-process module is CJS with a non-standard export shape that Node's
// static ESM/CJS interop can't always detect named exports from (some properties are
// defined in a way `cjs-module-lexer` misses) — importing the default and destructuring
// at runtime sidesteps that entirely. See docs/modules/desktop.md for the exact error
// this fixes if reverted.
const { app, BrowserWindow, safeStorage, shell } = electron;

// Local dev convenience: a git-ignored `apps/desktop/.env` file (already covered by
// the repo's root .gitignore) lets LASTFM_API_KEY/LASTFM_API_SECRET/
// BUG_REPORT_RELAY_URL persist across `npm run dev` launches instead of needing to be
// re-exported in the shell every time — set them once, they just keep working. Dev
// only: a packaged build has no reason to read a loose text file for secrets, and
// `app.getAppPath()` wouldn't point at a useful location for one anyway once
// packaged (see resolve-app-icon-path.ts's docstring on the same asar distinction).
// This project still never *generates* or hardcodes a real key anywhere — getting one
// from Last.fm is still on whoever runs this, same as always (see docs/modules/
// desktop.md); this only makes *using* one less repetitive once you have it.
// `process.loadEnvFile` is a built-in Node API (stable since Node 22.21/24.10,
// available since 20.12) — no new dependency needed for this.
if (!app.isPackaged) {
  const envFilePath = join(app.getAppPath(), ".env");
  if (existsSync(envFilePath)) {
    process.loadEnvFile(envFilePath);
  }
}

// Bounded ring buffer of recent log lines, attached to bug reports as diagnostics (see
// wireBugReport below) — never logs credentials (session keys, API secrets), only
// operational messages like "adapter construction failed" or "relay returned 502".
const logger = new Logger({
  level: "basic",
  sink: (entry) => {
    console.log(entry.message);
  },
});

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
  wireSettings({ store: settingsStore });

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

  // LASTFM_API_KEY/LASTFM_API_SECRET (baked into this build) take precedence, falling
  // back to a key the end user saved themselves via Preferences → Accounts. undefined
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
      // useful instead of alt-tabbing back to it themselves (PreferencesPage's
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
  wireLastfmData({ client: lastfmClient });

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

  wireTrackActions({ accountStore, createSessionClient });

  let onScrobbleEligible: Parameters<typeof createMainWindow>[1];
  if (accountStore && lastfmClient && createSessionClient) {
    const scrobbleQueue = new ScrobbleQueue({
      databasePath: join(userDataDir, "scrobble-queue.sqlite3"),
    });
    const scrobbling = wireScrobbling({
      queue: scrobbleQueue,
      accountStore,
      createSessionClient,
      onScrobbled: (items) => {
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
        showNotification({
          title: "Scrobbling is having trouble reaching Last.fm",
          body: `${reason} — will keep retrying in the background.`,
          ...notificationIconOption,
        });
      },
    });
    onScrobbleEligible = scrobbling.onScrobbleEligible;
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

  let mainWindow = createMainWindow(playbackSource, onScrobbleEligible, appIconPath);
  wireCloseToTray({
    window: mainWindow,
    settingsStore,
    isQuitting: () => isQuitting,
    onHide: handleTrayHide,
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

  tray = createTray({
    iconPath: resolveTrayIconPath(resourcePathOptions),
    onShow: () => {
      mainWindow.show();
      mainWindow.focus();
    },
    onQuit: () => {
      isQuitting = true;
      app.quit();
    },
  });

  app.on("before-quit", () => {
    isQuitting = true;
    tray?.destroy();
  });

  app.on("activate", () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) {
      mainWindow = createMainWindow(playbackSource, onScrobbleEligible, appIconPath);
      wireCloseToTray({
        window: mainWindow,
        settingsStore,
        isQuitting: () => isQuitting,
        onHide: handleTrayHide,
      });
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

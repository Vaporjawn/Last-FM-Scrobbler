import { join } from "node:path";
import electron from "electron";
import { LastfmClient, ScrobbleQueue } from "@lastfm-scrobbler/core";
import { createMainWindow } from "./create-main-window.js";
import { createPlatformPlaybackSource } from "./playback/create-platform-playback-source.js";
import { createLastfmClient } from "./lastfm/create-lastfm-client.js";
import { wireLastfmData } from "./lastfm/wire-lastfm-data.js";
import { createAccountStore } from "./auth/create-account-store.js";
import { wireAuth } from "./auth/wire-auth.js";
import { wireScrobbling } from "./scrobbling/wire-scrobbling.js";

// Electron's main-process module is CJS with a non-standard export shape that Node's
// static ESM/CJS interop can't always detect named exports from (some properties are
// defined in a way `cjs-module-lexer` misses) — importing the default and destructuring
// at runtime sidesteps that entirely. See docs/adr's desktop notes / this file's git
// history for the exact error this fixes if reverted.
const { app, BrowserWindow, safeStorage, shell } = electron;

// Constructed once at app startup, not per-window: it may spawn a real OS-level
// process (see packages/adapter-macos), and there should only ever be one of those
// per app instance regardless of how many windows come and go.
const playbackSource = createPlatformPlaybackSource();

// undefined when LASTFM_API_KEY/LASTFM_API_SECRET aren't set for this build — see
// main/lastfm/create-lastfm-client.ts and docs/modules/desktop.md. The app still
// launches without them; login and Last.fm data views just report "not configured".
const lastfmClient = createLastfmClient();

void app.whenReady().then(() => {
  const userDataDir = app.getPath("userData");

  const accountStore = createAccountStore({
    filePath: join(userDataDir, "secrets.json"),
    safeStorage,
  });

  wireAuth({
    accountStore,
    client: lastfmClient,
    openUrl: (url) => shell.openExternal(url),
  });
  wireLastfmData({ client: lastfmClient });

  let onScrobbleEligible: Parameters<typeof createMainWindow>[1];
  if (accountStore && lastfmClient) {
    const scrobbleQueue = new ScrobbleQueue({
      databasePath: join(userDataDir, "scrobble-queue.sqlite3"),
    });
    const scrobbling = wireScrobbling({
      queue: scrobbleQueue,
      accountStore,
      createSessionClient: (sessionKey) =>
        new LastfmClient({
          apiKey: process.env.LASTFM_API_KEY ?? "",
          apiSecret: process.env.LASTFM_API_SECRET ?? "",
          sessionKey,
        }),
    });
    onScrobbleEligible = scrobbling.onScrobbleEligible;
  }

  createMainWindow(playbackSource, onScrobbleEligible);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(playbackSource, onScrobbleEligible);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

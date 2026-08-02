import electronUpdater from "electron-updater";
import type { Logger } from "@lastfm-scrobbler/core";
import type { UpdaterClient } from "./updater-client.js";

export interface CreateUpdaterClientOptions {
  /** Forwarded to electron-updater's own `.logger` — never logs credentials (there
   * aren't any involved here), just check/download progress and errors. */
  readonly logger: Logger;
}

/**
 * Configures and returns electron-updater's real `autoUpdater` singleton, typed down
 * to the `UpdaterClient` interface `wire-updates.ts` actually uses. Reads its
 * "where to check" configuration from `resources/app-update.yml`, generated at package
 * time from `electron-builder.yml`'s `publish` block — see
 * docs/modules/desktop.md's "Auto-update" section.
 */
export function createUpdaterClient(options: CreateUpdaterClientOptions): UpdaterClient {
  const { logger } = options;

  // electron-updater is CJS with the same non-standard export shape as `electron`
  // itself (see main/index.ts's comment on that), but unlike `electron`'s own named
  // exports — plain data properties, already populated by the time any of this
  // project's code runs — `autoUpdater` is a *lazy getter with real side effects*
  // (verified directly against electron-updater 6.8.9's own source, `out/main.js`):
  // merely reading `.autoUpdater` runs `doLoadAutoUpdater()`, which constructs the
  // platform-specific updater (`MacUpdater` on macOS), whose constructor chain reads
  // `electron.app` via `ElectronAppAdapter`'s `require("electron").app` default
  // param. Destructuring this at module top level (this file's previous approach,
  // mirroring the safe `electron` pattern) ran that side effect during ES module
  // static import evaluation — before `main/index.ts` (this function's only caller)
  // ever reaches `app.whenReady()` — so `electron.app` wasn't a real, ready app yet,
  // and crashed with "Cannot read properties of undefined (reading 'getVersion')".
  // Reading it here instead, inside the function body this project only ever calls
  // after the app is ready, defers that side effect to a point where it's safe.
  const { autoUpdater } = electronUpdater;

  autoUpdater.autoDownload = true;
  // wire-updates.ts prompts the user and calls quitAndInstall() itself once a download
  // finishes — installing unprompted on quit would apply an update the user never
  // agreed to yet.
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = {
    info: (message: unknown) => {
      logger.info(String(message));
    },
    warn: (message: unknown) => {
      logger.warn(String(message));
    },
    error: (message: unknown) => {
      logger.error(String(message));
    },
    debug: (message: unknown) => {
      logger.debug(String(message));
    },
  };

  return autoUpdater;
}

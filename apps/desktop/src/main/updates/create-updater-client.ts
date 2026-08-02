import electronUpdater from "electron-updater";
import type { Logger } from "@lastfm-scrobbler/core";
import type { UpdaterClient } from "./updater-client.js";

// electron-updater is CJS with the same non-standard export shape as `electron`
// itself (see main/index.ts's comment on that) — Node's static ESM/CJS interop can't
// reliably detect `autoUpdater` as a named export, which surfaces at runtime (not at
// typecheck time, since the package's .d.ts still declares the named export) as
// `SyntaxError: Named export 'autoUpdater' not found` and crashes the whole main
// process on startup. Importing the default and destructuring at runtime sidesteps it,
// identically to the `electron` import elsewhere. See docs/modules/desktop.md.
const { autoUpdater } = electronUpdater;

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

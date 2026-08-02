import type { BrowserWindow } from "electron";
import electron from "electron";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";
import type { UpdateStatus } from "../../shared/update-status.js";
import type { UpdaterClient } from "./updater-client.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

/** This is a background app that can stay running for days between restarts (see
 * docs/modules/desktop.md's "Background app" section) — checking on launch alone
 * wouldn't catch a release that ships while it's already running. */
const DEFAULT_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

/** Give the app a moment to finish starting up (window created, tray icon up) before
 * making a network call, rather than racing it in immediately at wire-up. */
const INITIAL_CHECK_DELAY_MS = 10_000;

export interface WireUpdatesOptions {
  readonly client: UpdaterClient;
  readonly mainWindow: BrowserWindow;
  /** Reads the live `AppSettings.autoUpdateEnabled` value — a function rather than a
   * snapshot boolean, so a Settings toggle takes effect on the next scheduled
   * check without needing to re-wire anything. */
  readonly isAutoCheckEnabled: () => boolean;
  /** Injectable for testing; real callers pass `show-restart-prompt.ts`'s
   * `showRestartPrompt` bound to `mainWindow`. */
  readonly promptToRestart: (version: string) => Promise<boolean>;
  /** How often to check while running, if `isAutoCheckEnabled()` is true. */
  readonly checkIntervalMs?: number;
  /** Delay before the first check. */
  readonly initialCheckDelayMs?: number;
  /** Called when an update is found, right as it starts downloading in the
   * background — e.g. to show a native "Update found" notification (see
   * `main/index.ts`). Non-blocking and purely informational, unlike
   * `promptToRestart` above (which collects an actual decision once the download
   * finishes) — this is a background app whose window is often hidden (see
   * docs/modules/desktop.md's "Background app" section), so this is the only
   * reliable way the user learns a download has started at all. Optional — defaults
   * to a no-op. */
  readonly onUpdateAvailable?: (version: string) => void;
  /** Called on every failed check/download — e.g. to show a native error
   * notification. Not throttled the way `wire-scrobbling.ts`'s equivalent is: checks
   * only run every few hours here (see `checkIntervalMs`), so repeat notifications
   * are inherently far less frequent than a scrobble-queue outage retrying every
   * minute. Optional — defaults to a no-op. */
  readonly onUpdateCheckFailed?: (message: string) => void;
}

/**
 * Wires the auto-update IPC surface (see `shared/updates-api.ts`) to a real
 * `UpdaterClient`, and drives the actual check/download/prompt lifecycle: checks on
 * launch and periodically while running (both gated on `isAutoCheckEnabled()`),
 * downloads automatically once an update is found (`UpdaterClient.autoDownload` is
 * `true` — see `create-updater-client.ts`), and prompts to restart once the download
 * finishes. A manual check via `IPC_CHANNELS.updatesCheckNow` always runs regardless
 * of `isAutoCheckEnabled()` — "Check for updates now" in Settings shouldn't be
 * silently inert just because automatic checks are off.
 */
export function wireUpdates(options: WireUpdatesOptions): () => void {
  const {
    client,
    mainWindow,
    isAutoCheckEnabled,
    promptToRestart,
    checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS,
    initialCheckDelayMs = INITIAL_CHECK_DELAY_MS,
    onUpdateAvailable,
    onUpdateCheckFailed,
  } = options;

  let status: UpdateStatus = { phase: "idle" };

  function setStatus(next: UpdateStatus): void {
    status = next;
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.updatesStatusChanged, status);
    }
  }

  const onCheckingForUpdate = (): void => {
    setStatus({ phase: "checking" });
  };
  const handleUpdateAvailable = (info: { version: string }): void => {
    setStatus({ phase: "available", version: info.version });
    onUpdateAvailable?.(info.version);
  };
  const onUpdateNotAvailable = (): void => {
    setStatus({ phase: "not-available" });
  };
  const onDownloadProgress = (progress: { percent: number }): void => {
    setStatus({ phase: "downloading", percent: progress.percent });
  };
  const onUpdateDownloaded = (info: { version: string }): void => {
    setStatus({ phase: "downloaded", version: info.version });
    promptToRestart(info.version)
      .then((shouldRestart) => {
        if (shouldRestart) {
          client.quitAndInstall();
        }
      })
      .catch((error: unknown) => {
        console.error("updates: restart prompt failed:", error);
      });
  };
  const handleError = (error: Error): void => {
    setStatus({ phase: "error", message: error.message });
    onUpdateCheckFailed?.(error.message);
  };

  client.on("checking-for-update", onCheckingForUpdate);
  client.on("update-available", handleUpdateAvailable);
  client.on("update-not-available", onUpdateNotAvailable);
  client.on("download-progress", onDownloadProgress);
  client.on("update-downloaded", onUpdateDownloaded);
  client.on("error", handleError);

  ipcMain.handle(IPC_CHANNELS.updatesGetStatus, (): UpdateStatus => status);
  ipcMain.handle(IPC_CHANNELS.updatesCheckNow, async (): Promise<void> => {
    await client.checkForUpdates();
  });

  function maybeAutoCheck(): void {
    if (!isAutoCheckEnabled()) {
      return;
    }
    client.checkForUpdates().catch((error: unknown) => {
      // Also surfaced via the "error" event/status above for the UI — this is just so
      // a rejected promise from an unattended background check doesn't produce an
      // unhandled-rejection warning.
      console.error("updates: background check failed:", error);
    });
  }

  const initialCheckTimer = setTimeout(maybeAutoCheck, initialCheckDelayMs);
  const intervalTimer = setInterval(maybeAutoCheck, checkIntervalMs);

  return () => {
    clearTimeout(initialCheckTimer);
    clearInterval(intervalTimer);
    client.off("checking-for-update", onCheckingForUpdate);
    client.off("update-available", handleUpdateAvailable);
    client.off("update-not-available", onUpdateNotAvailable);
    client.off("download-progress", onDownloadProgress);
    client.off("update-downloaded", onUpdateDownloaded);
    client.off("error", handleError);
    ipcMain.removeHandler(IPC_CHANNELS.updatesGetStatus);
    ipcMain.removeHandler(IPC_CHANNELS.updatesCheckNow);
  };
}

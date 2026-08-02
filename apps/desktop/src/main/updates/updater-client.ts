/**
 * The subset of `electron-updater`'s `autoUpdater` singleton (an `EventEmitter`) that
 * `wire-updates.ts` actually uses — narrowed to a small, injectable interface so tests
 * can drive a fake event emitter instead of the real thing (which talks to a real
 * GitHub Releases feed and isn't something a unit test should touch). See
 * `create-updater-client.ts` for the real implementation.
 */
export interface UpdaterClient {
  /** electron-updater downloads a detected update automatically when this is `true` —
   * kept `true` by `createUpdaterClient()` so "found" and "downloaded" happen as one
   * user-visible step (see docs/modules/desktop.md's "Auto-update" section for why). */
  autoDownload: boolean;

  /** Starts a check (and, since `autoDownload` is `true`, download) — settles once
   * that whole sequence finishes or fails; the actual outcome arrives via the
   * `update-available`/`update-not-available`/`update-downloaded`/`error` events
   * below, not this promise's resolved value. */
  checkForUpdates(): Promise<unknown>;

  /** Quits and relaunches into the already-downloaded update — only meaningful after
   * an `update-downloaded` event. */
  quitAndInstall(): void;

  on(event: "checking-for-update", listener: () => void): unknown;
  on(
    event: "update-available" | "update-not-available" | "update-downloaded",
    listener: (info: { version: string }) => void,
  ): unknown;
  on(event: "download-progress", listener: (progress: { percent: number }) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;

  off(event: "checking-for-update", listener: () => void): unknown;
  off(
    event: "update-available" | "update-not-available" | "update-downloaded",
    listener: (info: { version: string }) => void,
  ): unknown;
  off(event: "download-progress", listener: (progress: { percent: number }) => void): unknown;
  off(event: "error", listener: (error: Error) => void): unknown;
}

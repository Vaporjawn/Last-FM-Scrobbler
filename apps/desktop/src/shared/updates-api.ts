import type { UpdateStatus } from "./update-status.js";

/**
 * The renderer-facing auto-update API the preload script exposes via
 * `contextBridge.exposeInMainWorld("updates", ...)`. See
 * `main/updates/wire-updates.ts` and docs/modules/desktop.md's "Auto-update" section.
 */
export interface UpdatesApi {
  /** The latest known status — resolves immediately with whatever's currently known
   * (starts at `{ phase: "idle" }` if no check has run yet this session), same
   * "pull current state" reasoning as `NowPlayingApi.getCurrent()`. */
  getStatus(): Promise<UpdateStatus>;
  /** Triggers a check immediately, regardless of the `autoUpdateEnabled` setting —
   * "Check for updates now" in Preferences always works even with automatic checks
   * turned off. Resolves once the check (and any resulting download) settles; watch
   * `onStatusChanged` for the actual outcome. */
  checkNow(): Promise<void>;
  onStatusChanged(callback: (status: UpdateStatus) => void): () => void;
}

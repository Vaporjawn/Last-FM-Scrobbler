import type { WindowBounds } from "../../shared/settings-api.js";
import type { SettingsStore } from "../settings/settings-store.js";

/** The subset of `Electron.BrowserWindow` this needs — narrowed for easy testing.
 * Arrow-function-property syntax (not method shorthand) so tests can reference e.g.
 * `window.getBounds` directly in assertions without tripping
 * `@typescript-eslint/unbound-method`. Two separate `onResize`/`onMove` methods,
 * rather than one Node-`EventEmitter`-style `on(event, listener)` — a single method
 * covering both events would need either a union-typed `event` parameter (which
 * doesn't structurally match `BrowserWindow.on`'s real per-literal overloads) or two
 * overloads on `on` itself (flagged by `@typescript-eslint/unified-signatures`, and
 * for good reason — collapsing them back into a union is exactly what breaks the real
 * assignment). The caller (`main/index.ts`) adapts the real `BrowserWindow` by calling
 * `window.on("resize", listener)` / `window.on("move", listener)` individually, where
 * each literal event name matches Electron's typing cleanly. */
export interface BoundsTrackedWindow {
  readonly onResize: (listener: () => void) => void;
  readonly onMove: (listener: () => void) => void;
  readonly getBounds: () => WindowBounds;
  readonly isDestroyed: () => boolean;
}

export interface PersistWindowBoundsOptions {
  readonly window: BoundsTrackedWindow;
  readonly settingsStore: Pick<SettingsStore, "set">;
  /** Delay in ms between the last resize/move event and the actual write — avoids a
   * disk write on every intermediate frame of a drag-resize. Defaults to 500. */
  readonly debounceMs?: number;
}

/**
 * Keeps `AppSettings.windowBounds` continuously up to date with the main window's real
 * size/position, so `create-main-window.ts` can restore it on the next launch. Saves
 * on every resize/move (debounced), not just on the window's `close` event — some quit
 * paths (e.g. the Settings "Restart now" flow after saving new API credentials, which
 * calls `app.exit()` directly) bypass `close` entirely, so "remember its last size"
 * has to mean "stay continuously current," not "capture once on the way out."
 */
export function persistWindowBounds(options: PersistWindowBoundsOptions): () => void {
  const { window, settingsStore, debounceMs = 500 } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function scheduleSave(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      // The window may have closed (and been destroyed) in the gap between the last
      // resize/move event and this timer firing — getBounds() on a destroyed window
      // throws, so this guard isn't optional.
      if (!window.isDestroyed()) {
        settingsStore.set({ windowBounds: window.getBounds() });
      }
    }, debounceMs);
  }

  window.onResize(scheduleSave);
  window.onMove(scheduleSave);

  return () => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  };
}

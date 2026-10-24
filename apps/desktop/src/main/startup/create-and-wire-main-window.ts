import type { Logger } from "@lastfm-scrobbler/core";
import type { PlaybackSource } from "@lastfm-scrobbler/shared-types";
import { createMainWindow, type CreateMainWindowOptions } from "../create-main-window.js";
import type { createSettingsStore } from "../settings/settings-store.js";
import { wireCloseToTray } from "../tray/wire-close-to-tray.js";
import { persistWindowBounds } from "../window/persist-window-bounds.js";
import { resolveAspectRatioValue } from "../window/resolve-aspect-ratio.js";
import { compileFilterExpression } from "./compile-filter-expression.js";

/** What `createAndWireMainWindow` needs from the rest of startup. */
export interface CreateAndWireMainWindowOptions {
  readonly settingsStore: ReturnType<typeof createSettingsStore>;
  readonly logger: Logger;
  /** The single playback source shared by every window. */
  readonly playbackSource: PlaybackSource | undefined;
  readonly onScrobbleEligible: CreateMainWindowOptions["onScrobbleEligible"] | undefined;
  readonly onTrackChanged: CreateMainWindowOptions["onTrackChanged"] | undefined;
  /** The development-only app icon path; `undefined` in a packaged build. */
  readonly appIconPath: string | undefined;
  /** True while the app is really quitting, so closing the window must not hide it to the tray. */
  readonly isQuitting: () => boolean;
  /** Called when the window is hidden to the tray. */
  readonly onHide: () => void;
  /** Only ever set for the very first window; see the function docstring. */
  readonly startHidden?: boolean;
}

/**
 * Creates a main window and attaches the three things every new one needs: hide-to-tray on
 * close and bounds persistence, on top of the window itself. Used both for the very first
 * window and for a replacement one in the `activate` handler (macOS re-opens the app via the
 * dock after every window has been closed with closeToTray disabled).
 *
 * `startHidden` is only ever passed for the very first window (resolved from
 * `AppSettings.startMinimized` and whether this process launch was actually triggered by the
 * OS login item, see `resolveStartHidden`): a manual launch must never start hidden even with
 * the setting on. The `activate` handler calls this without it, correctly defaulting to
 * `false`: a dock-icon click while the app has no windows is always an explicit request to see
 * it.
 */
export function createAndWireMainWindow(
  options: CreateAndWireMainWindowOptions,
): Electron.BrowserWindow {
  const { windowBounds, aspectRatio, filterExpression, skipNonMusicVideos, themeMode } =
    options.settingsStore.get();
  // Compiled once, here, not live-updated: unlike aspectRatio/themeMode above,
  // `Tracker` (packages/core) has no way to swap its filter after construction, so
  // a filter-expression/skipNonMusicVideos change only takes effect on the next
  // window this function creates — in practice, an app restart. Settings → Filter
  // tells the user this explicitly when they save a change.
  const filter = compileFilterExpression({ filterExpression, skipNonMusicVideos }, options.logger);
  const window = createMainWindow({
    playbackSource: options.playbackSource,
    ...(options.onScrobbleEligible ? { onScrobbleEligible: options.onScrobbleEligible } : {}),
    ...(options.onTrackChanged ? { onTrackChanged: options.onTrackChanged } : {}),
    ...(options.appIconPath ? { iconPath: options.appIconPath } : {}),
    ...(windowBounds ? { initialBounds: windowBounds } : {}),
    initialAspectRatio: resolveAspectRatioValue(aspectRatio),
    ...(filter ? { filter } : {}),
    ...(options.startHidden ? { startHidden: true } : {}),
    initialThemeMode: themeMode,
  });
  wireCloseToTray({
    window,
    settingsStore: options.settingsStore,
    isQuitting: options.isQuitting,
    onHide: options.onHide,
  });
  const stopPersistingBounds = persistWindowBounds({
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
    settingsStore: options.settingsStore,
  });
  // Cancels any still-pending debounced save when the window actually closes —
  // low-impact to skip (the pending timer's own isDestroyed() guard already makes a
  // stray post-close fire a no-op), but the same discarded-cleanup pattern that
  // caused a real bug for wireNowPlaying's cleanup above, so it's captured here too
  // for consistency/defense-in-depth rather than left as a dangling timer handle.
  window.once("closed", stopPersistingBounds);
  return window;
}

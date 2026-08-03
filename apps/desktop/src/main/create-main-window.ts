import { join } from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";
import type { PlaybackSource } from "@lastfm-scrobbler/shared-types";
import type {
  CompiledFilter,
  ScrobbleEligibleEvent,
  TrackChangedEvent,
} from "@lastfm-scrobbler/core";
import type { WindowBounds } from "../shared/settings-api.js";
import { computeMinimumSizeForAspectRatio } from "./window/compute-minimum-size-for-aspect-ratio.js";
import { isSafeExternalUrl } from "./window/is-safe-external-url.js";
import { wireNowPlaying } from "./playback/wire-now-playing.js";

/** This window's hardcoded default size, used whenever there's no `initialBounds` to
 * restore (first launch, or nothing ever saved) — see the `width`/`height` usage
 * below. */
const DEFAULT_WIDTH = 1100;
const DEFAULT_HEIGHT = 720;

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { BrowserWindow, screen, shell } from "electron"`.
const { BrowserWindow, screen, shell } = electron;

const dirname = fileURLToPath(new URL(".", import.meta.url));

/** This window's real minimum height (see the `minHeight` usage below for why 480
 * specifically). Exported so `main/index.ts`'s aspect-ratio change handler can clamp
 * its own immediate resize to the same real constraint, rather than duplicating the
 * number and risking the two drifting apart. */
export const MIN_WINDOW_HEIGHT = 480;

/** This window's real minimum width (see the `minWidth` usage below for why 680
 * specifically). Exported for the same reason as `MIN_WINDOW_HEIGHT` — `main/index.ts`'s
 * aspect-ratio change handler needs it to clamp a portrait ratio's (e.g. `"9:16"`)
 * derived width, the same way it already clamps a landscape ratio's derived height. */
export const MIN_WINDOW_WIDTH = 680;

/** Whether rectangle `a` overlaps rectangle `b` at all (touching edges don't count —
 * matches the everyday sense of "is any part of this actually visible on that
 * screen"). Used below to decide whether a restored window position is still usable. */
function rectanglesIntersect(
  a: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  b: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}

export interface CreateMainWindowOptions {
  /** `undefined` on platforms without a working adapter yet — see
   * `playback/create-platform-playback-source.ts`. */
  readonly playbackSource: PlaybackSource | undefined;
  /** Receives every play that crosses the scrobble threshold — see
   * `main/scrobbling/wire-scrobbling.ts` for what a real caller passes. */
  readonly onScrobbleEligible?: (event: ScrobbleEligibleEvent) => void;
  /** Receives every new distinct track, immediately (not gated on the scrobble
   * threshold) — see `main/scrobbling/wire-scrobbling.ts`'s `onTrackChanged` for what
   * a real caller passes (a real-time Last.fm "now playing" update). */
  readonly onTrackChanged?: (event: TrackChangedEvent) => void;
  /** Dev mode only (see `resolve-app-icon-path.ts`) — sets the window/taskbar icon on
   * Windows/Linux. A packaged build's icon comes from `electron-builder.yml` instead,
   * baked into the app bundle, so this is a no-op to omit there. Has no effect on
   * macOS's Dock icon specifically — see `main/index.ts`'s separate
   * `app.dock.setIcon()` call for that. */
  readonly iconPath?: string;
  /** Restores the window to its size/position from the end of the last session (see
   * `main/window/persist-window-bounds.ts` and `AppSettings.windowBounds`) — omit to
   * fall back to this function's own built-in default: `DEFAULT_WIDTH`x`DEFAULT_HEIGHT`
   * (1100x720, centered) normally, or a portrait size derived from `initialAspectRatio`
   * when that's set to a portrait ratio — see the `isPortraitRatio`/`defaultSize` logic
   * below for why. */
  readonly initialBounds?: WindowBounds;
  /** Locks the window's resize aspect ratio (width/height) — `0` or omitted means free
   * resizing, Electron's own default. See `main/window/resolve-aspect-ratio.ts` for
   * how a Settings selection becomes this number. */
  readonly initialAspectRatio?: number;
  /** A compiled `AppSettings.filterExpression` (see that field's docstring) — tracks
   * matching it are excluded from `onScrobbleEligible`/`onTrackChanged` entirely, but
   * still relayed to the renderer's "Now Playing" view unfiltered (see
   * `wireNowPlaying`'s own docstring for why those are different questions). Omit for
   * no filtering, this app's original behavior. */
  readonly filter?: CompiledFilter;
  /** When `true`, the window is created without ever showing itself automatically —
   * used for `AppSettings.startMinimized`'s "a login-triggered launch shouldn't pop a
   * window in the user's face" behavior (see `main/index.ts`). The window still loads
   * and runs completely normally in the background (IPC, playback tracking, and
   * scrobbling all keep working exactly as when visible — the same "hidden but fully
   * alive" state `main/tray/wire-close-to-tray.ts` already puts the window in when the
   * user closes-to-tray); it's shown later via the tray icon/menu bar, same as
   * returning from that. Omit (or `false`), this app's original and default behavior,
   * to show the window as soon as its first frame is ready, same as before this option
   * existed. */
  readonly startHidden?: boolean;
}

/**
 * Creates and shows the app's main window, wiring up now-playing IPC against it when a
 * platform playback source is available. See `CreateMainWindowOptions` for what each
 * option controls.
 */
export function createMainWindow(options: CreateMainWindowOptions): Electron.BrowserWindow {
  const {
    playbackSource,
    onScrobbleEligible,
    onTrackChanged,
    iconPath,
    initialBounds,
    initialAspectRatio,
    filter,
    startHidden,
  } = options;

  // `initialBounds` (a prior session's real size/position) takes precedence over any
  // of this — it only matters on first launch, or if nothing was ever saved (see
  // `main/window/persist-window-bounds.ts`). Without it, a portrait `initialAspectRatio`
  // (e.g. the `"9:14"` default — see `AppSettings.aspectRatio`) needs its own default
  // size, not the hardcoded landscape `DEFAULT_WIDTH`x`DEFAULT_HEIGHT` below: applying
  // `setAspectRatio()` further down only *constrains future resizing*, it doesn't
  // resize the window itself, so a fresh install would otherwise launch in a plain
  // landscape window that merely can't be resized away from the default later — never
  // visually portrait at all despite that being the whole point of the default. See
  // `computeMinimumSizeForAspectRatio` below for how that default size is derived.
  const isPortraitRatio =
    initialAspectRatio !== undefined && initialAspectRatio > 0 && initialAspectRatio < 1;

  // The display this window will actually land on — `getDisplayMatching` against the
  // real restored position when there is one, since a multi-monitor setup's displays
  // can have different available sizes; `getPrimaryDisplay()` as the best available
  // guess before the window (and therefore any real position) exists yet.
  const targetDisplay = initialBounds
    ? screen.getDisplayMatching({
        x: initialBounds.x,
        y: initialBounds.y,
        width: initialBounds.width,
        height: initialBounds.height,
      })
    : screen.getPrimaryDisplay();

  // Reconciles the flat, content-driven `MIN_WINDOW_WIDTH`/`MIN_WINDOW_HEIGHT` floors
  // below against `initialAspectRatio` (when locked to one) and the target display's
  // real capacity — see `computeMinimumSizeForAspectRatio`'s own docstring for why
  // this matters even at launch, not just for a *live* ratio change: this app's
  // default ratio (`"9:14"`) is wildly disproportionate to the flat floors alone (a
  // 680-wide window at that ratio needs to be over 1000px tall), so without this, a
  // freshly launched *or restored* window would start out already sitting exactly at
  // its own width floor with a locked aspect ratio — meaning the very first inward
  // resize drag a user makes would immediately hit the native macOS corruption this
  // function exists to avoid (verified live — see that function's docstring).
  const minimumSize = computeMinimumSizeForAspectRatio(
    initialAspectRatio ?? 0,
    MIN_WINDOW_WIDTH,
    MIN_WINDOW_HEIGHT,
    targetDisplay.workArea.width,
    targetDisplay.workArea.height,
  );

  // `minimumSize` is already both ratio-consistent and screen-safe (see
  // computeMinimumSizeForAspectRatio) — for a portrait ratio, it's directly the
  // narrowest, most convincingly portrait size this app's current layout can offer on
  // this display, so it's used as-is rather than deriving a second, separate size.
  // The landscape/square/free-ratio default, unlike the portrait one, used to be the
  // flat DEFAULT_WIDTH/DEFAULT_HEIGHT with no clamp against the target display at all
  // — fine on an ordinary monitor, but a user who changes AppSettings.aspectRatio away
  // from the portrait default *before* ever resizing/moving the window (so
  // windowBounds is still unset) and then relaunches on a smaller screen (an older/
  // smaller laptop, a projector, a small external monitor) would get a window
  // constructed wider/taller than the visible screen, with nothing to clamp it.
  const defaultSize = isPortraitRatio
    ? minimumSize
    : {
        width: Math.min(DEFAULT_WIDTH, Math.floor(targetDisplay.workArea.width * 0.9)),
        height: Math.min(DEFAULT_HEIGHT, Math.floor(targetDisplay.workArea.height * 0.9)),
      };

  // A restored position from a prior session (`AppSettings.windowBounds`) can point
  // at a display that's no longer connected (a second monitor unplugged/reconfigured
  // since the window was last positioned there) — using it verbatim would construct
  // (and, for a non-hidden launch, show) the window fully off any visible screen,
  // making the app appear completely unreachable. `targetDisplay` was already chosen
  // as the closest match for this position via `getDisplayMatching` above, which
  // never returns nothing — so the only way to detect "this position isn't actually
  // usable" is to check whether it overlaps that display's own work area at all.
  const restoredPositionIsOnScreen =
    initialBounds !== undefined &&
    rectanglesIntersect(
      {
        x: initialBounds.x,
        y: initialBounds.y,
        width: initialBounds.width,
        height: initialBounds.height,
      },
      targetDisplay.workArea,
    );

  const mainWindow = new BrowserWindow({
    width: initialBounds?.width ?? defaultSize.width,
    height: initialBounds?.height ?? defaultSize.height,
    ...(initialBounds && restoredPositionIsOnScreen
      ? { x: initialBounds.x, y: initialBounds.y }
      : {}),
    // No app-level breakpoints reflow the fixed-width sidebar + content layout below
    // this — live-testing every page down from 1100 wide (Playwright, resized in
    // steps) showed content was still fully readable at 680x480 but visibly degraded
    // by 450 wide (body text wrapping to two or three words per line) and broke
    // outright by 360 (one word per line, switches overlapping wrapped labels).
    // Flooring the window here, rather than trying to make the layout fluid all the
    // way down to phone widths, matches how desktop apps in this genre (and the
    // official Last.fm client this project's UI is modeled on) handle it — the
    // existing sidebar-collapse control already covers reclaiming space below that
    // for users who want it. `minimumSize` (not the flat MIN_WINDOW_WIDTH/
    // MIN_WINDOW_HEIGHT directly) is what's actually enforced — see above.
    minWidth: minimumSize.width,
    minHeight: minimumSize.height,
    ...(iconPath ? { icon: iconPath } : {}),
    // Don't paint the window until the renderer has produced its first frame —
    // avoids the blank/white-flash window Electron otherwise shows immediately, and
    // avoids compositing an empty window while the renderer is still starting up.
    show: false,
    webPreferences: {
      preload: join(dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Electron's default sandboxed preload loader (`sandbox: true`, the default
      // since Electron 20) runs preload scripts through a restricted, non-Node module
      // loader that only understands CommonJS — it cannot execute an ES module, and
      // fails with "SyntaxError: Cannot use import statement outside a module" for our
      // ESM preload build (`out/preload/index.mjs`, produced because this package sets
      // `"type": "module"` — see electron-vite's format-detection logic). When the
      // preload fails to load, `contextBridge.exposeInMainWorld` never runs, so every
      // `window.*` API (`window.auth`, `window.settings`, etc.) is silently
      // `undefined` in the renderer — which is why every hook's "outside a real
      // Electron renderer" fallback kicked in (e.g. Settings' Accounts section
      // spinning forever, since `useAuth`'s initial fetch just returns early with
      // `isConfigured` stuck at its loading value). Disabling the *preload* sandbox
      // here routes preload loading through Electron's regular Node-based loader
      // (which does support ESM) instead — contextIsolation and nodeIntegration above
      // are what actually keep the renderer's web content isolated from Node, and
      // neither is affected by this setting.
      sandbox: false,
      // Electron enables Chromium's Hunspell-based spellchecker by default, which
      // loads dictionary data and runs its own utility process. This app has no
      // free-text input surfaces, so there's nothing for it to check — skip the
      // memory and process overhead entirely rather than pay for a feature that
      // never triggers.
      spellcheck: false,
    },
  });

  if (initialAspectRatio) {
    mainWindow.setAspectRatio(initialAspectRatio);
  }

  mainWindow.once("ready-to-show", () => {
    if (!startHidden) {
      mainWindow.show();
    }
  });

  // Any `<a target="_blank">`/`window.open()` in the renderer (the "Get your Last.fm
  // API key" link, the artist bio's "Read more on Last.fm" link, etc.) would otherwise
  // open in a brand-new *Electron* window by default — Electron's own window, not the
  // user's actual browser, with none of their logins/extensions/etc. Deny creating
  // that window and hand the URL to the OS's real default browser instead, same as
  // `AuthFlow`'s `openUrl` already does for the Last.fm authorization step (see
  // `main/index.ts`'s `wireAuth` call) — this makes every other external link in the
  // app behave the same way without each one needing its own IPC plumbing.
  //
  // `isSafeExternalUrl` gates this before it ever reaches `shell.openExternal`:
  // several renderer links (NowPlayingPage's/ScrobbleDetailPage's `trackDetail.url`,
  // BugReportDialog's `issueUrl`) are built from external, unsanitized data — a Last.fm
  // API response, a relay's HTTP response — not something this app controls. Electron's
  // security checklist warns against handing `openExternal` untrusted content, since a
  // crafted `file:`/`javascript:`/custom-protocol URL can trigger unintended local
  // behavior depending on platform and what's registered as a handler for it.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (playbackSource) {
    // `wireNowPlaying`'s returned cleanup MUST be captured and invoked when this
    // specific window goes away, not discarded — `playbackSource` is normally a
    // shared, module-level singleton (see main/index.ts) that outlives any one
    // window. Previously this cleanup was thrown away entirely: recreating the main
    // window (e.g. "close to tray" off, window closed for real, then reopened via the
    // Dock icon on macOS) hit Electron's "second handler for the same channel" throw
    // inside wireNowPlaying's own `ipcMain.handle(nowPlayingGetCurrent, ...)`, since
    // the first window's handler was never unregistered — and even once that's fixed,
    // the first window's now-destroyed `webContents.send` callback would still be
    // subscribed to the shared source, throwing on the next track/state change.
    const cleanupNowPlaying = onScrobbleEligible
      ? wireNowPlaying(playbackSource, mainWindow, onScrobbleEligible, onTrackChanged, filter)
      : wireNowPlaying(playbackSource, mainWindow, undefined, onTrackChanged, filter);
    mainWindow.once("closed", cleanupNowPlaying);
  }

  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(join(dirname, "../renderer/index.html"));
  }

  return mainWindow;
}

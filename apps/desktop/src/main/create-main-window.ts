import { join } from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";
import type { PlaybackSource } from "@lastfm-scrobbler/shared-types";
import type { CompiledFilter, ScrobbleEligibleEvent, TrackChangedEvent } from "@lastfm-scrobbler/core";
import type { WindowBounds } from "../shared/settings-api.js";
import { computePortraitWindowSize } from "./window/compute-portrait-window-size.js";
import { isSafeExternalUrl } from "./window/is-safe-external-url.js";
import { wireNowPlaying } from "./playback/wire-now-playing.js";

/** This window's hardcoded default size, used whenever there's no `initialBounds` to
 * restore (first launch, or nothing ever saved) — see the `width`/`height` usage
 * below. */
const DEFAULT_WIDTH = 1100;
const DEFAULT_HEIGHT = 720;

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { BrowserWindow, shell } from "electron"`.
const { BrowserWindow, shell } = electron;

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
  // (e.g. the `"9:16"` default — see `AppSettings.aspectRatio`) needs its own default
  // size, not the hardcoded landscape `DEFAULT_WIDTH`x`DEFAULT_HEIGHT` below: applying
  // `setAspectRatio()` further down only *constrains future resizing*, it doesn't
  // resize the window itself, so a fresh install would otherwise launch in a plain
  // landscape window that merely can't be resized away from 9:16 later — never
  // visually portrait at all despite that being the whole point of the default.
  // `computePortraitWindowSize` is the same anchor-on-minWidth logic `main/index.ts`'s
  // `onAspectRatioChange` uses when the user *changes* to a portrait ratio live; reused
  // here for the "already set at launch" case. `currentWidth`/`currentHeight` are
  // irrelevant to its portrait branch (only the "free"/0 no-op branch reads them, which
  // never applies here since this whole branch is gated on a truthy, portrait ratio) —
  // passing the landscape defaults through is harmless.
  const isPortraitRatio =
    initialAspectRatio !== undefined && initialAspectRatio > 0 && initialAspectRatio < 1;
  const defaultSize = isPortraitRatio
    ? computePortraitWindowSize(DEFAULT_WIDTH, DEFAULT_HEIGHT, initialAspectRatio, MIN_WINDOW_WIDTH)
    : { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };

  const mainWindow = new BrowserWindow({
    width: initialBounds?.width ?? defaultSize.width,
    height: initialBounds?.height ?? defaultSize.height,
    ...(initialBounds ? { x: initialBounds.x, y: initialBounds.y } : {}),
    // No app-level breakpoints reflow the fixed-width sidebar + content layout below
    // this — live-testing every page down from 1100 wide (Playwright, resized in
    // steps) showed content was still fully readable at 680x480 but visibly degraded
    // by 450 wide (body text wrapping to two or three words per line) and broke
    // outright by 360 (one word per line, switches overlapping wrapped labels).
    // Flooring the window here, rather than trying to make the layout fluid all the
    // way down to phone widths, matches how desktop apps in this genre (and the
    // official Last.fm client this project's UI is modeled on) handle it — the
    // existing sidebar-collapse control already covers reclaiming space below that
    // for users who want it.
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
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
    if (onScrobbleEligible) {
      wireNowPlaying(playbackSource, mainWindow, onScrobbleEligible, onTrackChanged, filter);
    } else {
      wireNowPlaying(playbackSource, mainWindow, undefined, onTrackChanged, filter);
    }
  }

  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(join(dirname, "../renderer/index.html"));
  }

  return mainWindow;
}

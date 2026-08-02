import { join } from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";
import type { PlaybackSource } from "@lastfm-scrobbler/shared-types";
import type { ScrobbleEligibleEvent } from "@lastfm-scrobbler/core";
import { wireNowPlaying } from "./playback/wire-now-playing.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { BrowserWindow, shell } from "electron"`.
const { BrowserWindow, shell } = electron;

const dirname = fileURLToPath(new URL(".", import.meta.url));

/**
 * Creates and shows the app's main window, wiring up now-playing IPC against it when a
 * platform playback source is available (`playbackSource` is `undefined` on platforms
 * without a working adapter yet — see `playback/create-platform-playback-source.ts`).
 * `onScrobbleEligible`, when provided, receives every play that crosses the scrobble
 * threshold — see `main/scrobbling/wire-scrobbling.ts` for what a real caller passes.
 * `iconPath`, when provided (dev mode only — see `resolve-app-icon-path.ts`), sets the
 * window/taskbar icon on Windows/Linux; a packaged build's icon comes from
 * `electron-builder.yml` instead, baked into the app bundle itself, so this is a no-op
 * to omit there. Has no effect on macOS's Dock icon specifically — see
 * `main/index.ts`'s separate `app.dock.setIcon()` call for that.
 */
export function createMainWindow(
  playbackSource: PlaybackSource | undefined,
  onScrobbleEligible?: (event: ScrobbleEligibleEvent) => void,
  iconPath?: string,
): Electron.BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
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
      // Electron renderer" fallback kicked in (e.g. Preferences' Accounts section
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

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Any `<a target="_blank">`/`window.open()` in the renderer (the "Get your Last.fm
  // API key" link, the artist bio's "Read more on Last.fm" link, etc.) would otherwise
  // open in a brand-new *Electron* window by default — Electron's own window, not the
  // user's actual browser, with none of their logins/extensions/etc. Deny creating
  // that window and hand the URL to the OS's real default browser instead, same as
  // `AuthFlow`'s `openUrl` already does for the Last.fm authorization step (see
  // `main/index.ts`'s `wireAuth` call) — this makes every other external link in the
  // app behave the same way without each one needing its own IPC plumbing.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (playbackSource) {
    if (onScrobbleEligible) {
      wireNowPlaying(playbackSource, mainWindow, onScrobbleEligible);
    } else {
      wireNowPlaying(playbackSource, mainWindow);
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

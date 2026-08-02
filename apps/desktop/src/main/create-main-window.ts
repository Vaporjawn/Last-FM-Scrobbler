import { join } from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";
import type { PlaybackSource } from "@lastfm-scrobbler/shared-types";
import type { ScrobbleEligibleEvent } from "@lastfm-scrobbler/core";
import { wireNowPlaying } from "./playback/wire-now-playing.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { BrowserWindow } from "electron"`.
const { BrowserWindow } = electron;

const dirname = fileURLToPath(new URL(".", import.meta.url));

/**
 * Creates and shows the app's main window, wiring up now-playing IPC against it when a
 * platform playback source is available (`playbackSource` is `undefined` on platforms
 * without a working adapter yet — see `playback/create-platform-playback-source.ts`).
 * `onScrobbleEligible`, when provided, receives every play that crosses the scrobble
 * threshold — see `main/scrobbling/wire-scrobbling.ts` for what a real caller passes.
 */
export function createMainWindow(
  playbackSource: PlaybackSource | undefined,
  onScrobbleEligible?: (event: ScrobbleEligibleEvent) => void,
): Electron.BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    // Don't paint the window until the renderer has produced its first frame —
    // avoids the blank/white-flash window Electron otherwise shows immediately, and
    // avoids compositing an empty window while the renderer is still starting up.
    show: false,
    webPreferences: {
      preload: join(dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
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

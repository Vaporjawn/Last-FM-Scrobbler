import { join } from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { BrowserWindow, screen } from "electron"`.
const { BrowserWindow, screen } = electron;

const dirname = fileURLToPath(new URL(".", import.meta.url));

/** Small enough to feel like a quick glance, not a second copy of the main window —
 * roughly matches the reference menu-bar-app sizing (album art + two lines of text +
 * a couple of buttons) this popover is modeled on. */
export const TRAY_POPOVER_SIZE = { width: 320, height: 180 };

/**
 * Creates the tray/menu-bar mini-player popover window — hidden by default, shown and
 * positioned (see `position-tray-popover.ts`) by `create-tray.ts` on a tray icon
 * click. Loads the exact same renderer bundle as the main window, distinguished only
 * by a `#tray-popover` URL hash `main.tsx` checks to decide which view to mount (see
 * there) — reusing the same bundle means it automatically gets the same preload
 * script, CSP, and IPC bridges (`window.nowPlaying`, `window.lastfm`, etc.) with zero
 * additional main-process wiring, rather than standing up a second renderer entry
 * point purely for one small view.
 *
 * `frame: false` + fixed, non-resizable size + `skipTaskbar: true` are what make this
 * read as a transient popover rather than a second real window — closer to how a
 * native macOS/Windows tray/menu-bar popover behaves than a normal titled window
 * would. Hidden on blur (see `wireTrayPopoverAutoHide` in `create-tray.ts`) the same
 * way, matching that same convention (click the icon, glance at it, click away to
 * dismiss).
 */
export function createTrayPopoverWindow(): Electron.BrowserWindow {
  const popover = new BrowserWindow({
    width: TRAY_POPOVER_SIZE.width,
    height: TRAY_POPOVER_SIZE.height,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    // Never shows up in the Dock/taskbar or an Alt-Tab/Cmd-Tab switcher — this is a
    // transient glance-and-dismiss popover, not a real window a user would want to
    // switch to independently of the tray icon that opens it.
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(dirname, "../../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // See create-main-window.ts's own identical setting for why.
      sandbox: false,
      spellcheck: false,
    },
  });

  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (devServerUrl) {
    void popover.loadURL(`${devServerUrl}#tray-popover`);
  } else {
    void popover.loadFile(join(dirname, "../../renderer/index.html"), { hash: "tray-popover" });
  }

  // Dismisses the popover the same way a native menu-bar app's would: click the icon
  // to glance at it, click anywhere else to close it. `blur` fires on real focus loss
  // (clicking the main window, another app, etc.) — not on the popover's own content
  // re-rendering, so this can't accidentally hide it out from under an interaction in
  // progress.
  popover.on("blur", () => {
    popover.hide();
  });

  return popover;
}

/**
 * Where the popover's *screen* (not just position within it) is — `screen.
 * getDisplayNearestPoint()` keyed on the tray icon's own bounds, so a popover on a
 * multi-monitor setup clamps to whichever display the tray icon actually lives on,
 * not always the primary one. Exported separately from `positionTrayPopover` itself
 * (a pure function, easy to unit test) since resolving *this* value requires the real
 * Electron `screen` module, which isn't available outside a running Electron process.
 */
export function resolvePopoverScreenBounds(trayBounds: Electron.Rectangle): Electron.Rectangle {
  return screen.getDisplayNearestPoint({
    x: trayBounds.x + trayBounds.width / 2,
    y: trayBounds.y + trayBounds.height / 2,
  }).bounds;
}

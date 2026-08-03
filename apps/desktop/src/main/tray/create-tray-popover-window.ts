import { join } from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";
import { TRAY_POPOVER_SIZE } from "./tray-popover-size.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { BrowserWindow } from "electron"`.
const { BrowserWindow } = electron;

const dirname = fileURLToPath(new URL(".", import.meta.url));

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
 * would. Hidden on blur (see this function's own `"blur"` listener below) the same
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

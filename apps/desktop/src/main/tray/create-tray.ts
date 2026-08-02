import electron from "electron";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { Menu, Tray, nativeImage } from "electron"`.
const { Menu, Tray, nativeImage } = electron;

export interface CreateTrayOptions {
  /** See `main/tray/resolve-tray-icon-path.ts`. */
  readonly iconPath: string;
  /** Shows and focuses the main window — called from the tray's "Show" item and, on
   * platforms where clicking the icon itself doesn't already open the context menu,
   * from a left-click on the icon. */
  readonly onShow: () => void;
  /** Actually quits the app (not just hides the window) — called from the tray's
   * "Quit" item. Callers are responsible for setting whatever "is quitting" flag
   * `main/tray/wire-close-to-tray.ts` checks *before* calling `app.quit()`. */
  readonly onQuit: () => void;
}

/**
 * Creates the tray/menu-bar icon that keeps the app reachable once
 * `wire-close-to-tray.ts` has hidden the main window. macOS renders `iconPath` as a
 * template image (recolored automatically for the light/dark menu bar); other
 * platforms render it as-is.
 */
export function createTray(options: CreateTrayOptions): Electron.Tray {
  const { iconPath, onShow, onQuit } = options;

  const icon = nativeImage.createFromPath(iconPath);
  if (process.platform === "darwin") {
    icon.setTemplateImage(true);
  }

  const tray = new Tray(icon);
  tray.setToolTip("Last.fm Scrobbler");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show Last.fm Scrobbler", click: () => { onShow(); } },
      { type: "separator" },
      { label: "Quit", click: () => { onQuit(); } },
    ]),
  );
  // On Windows/Linux a left-click doesn't open the context menu by default (only
  // right-click does) — wire it to reopen the window directly, which is the behavior
  // users expect from a tray icon. On macOS, setContextMenu already makes any click
  // open the menu, so this listener simply never fires there.
  tray.on("click", () => { onShow(); });

  return tray;
}

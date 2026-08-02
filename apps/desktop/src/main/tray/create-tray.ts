import electron from "electron";
import { TRAY_POPOVER_SIZE } from "./create-tray-popover-window.js";
import { positionTrayPopover } from "./position-tray-popover.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { Menu, Tray, nativeImage } from "electron"`.
const { Menu, Tray, nativeImage } = electron;

export interface CreateTrayOptions {
  /** See `main/tray/resolve-tray-icon-path.ts`. */
  readonly iconPath: string;
  /** Shows and focuses the main window — called from the tray's "Show Last.fm
   * Scrobbler" menu item (right-click, or left-click when `popover` isn't given). */
  readonly onShow: () => void;
  /** Actually quits the app (not just hides the window) — called from the tray's
   * "Quit" item. Callers are responsible for setting whatever "is quitting" flag
   * `main/tray/wire-close-to-tray.ts` checks *before* calling `app.quit()`. */
  readonly onQuit: () => void;
  /** The mini-player popover window (see `create-tray-popover-window.ts`) a
   * left-click toggles, positioned next to the tray icon each time it opens. Omit
   * entirely (falling back to this function's original behavior — left-click and
   * right-click both just show the main window/menu) for a caller that doesn't have
   * one, e.g. if the popover window failed to construct for some reason; a tray icon
   * that can still reach the full app is strictly more important than the popover
   * shortcut on top of it. */
  readonly popover?: Electron.BrowserWindow;
  /** Resolves which display's bounds to clamp the popover's position within — see
   * `create-tray-popover-window.ts`'s `resolvePopoverScreenBounds` for why this needs
   * a real `screen` module reference this file itself doesn't otherwise depend on.
   * Required alongside `popover` (both or neither) since positioning is meaningless
   * without something to position. */
  readonly resolvePopoverScreenBounds?: (trayBounds: Electron.Rectangle) => Electron.Rectangle;
}

/**
 * Creates the tray/menu-bar icon that keeps the app reachable once
 * `wire-close-to-tray.ts` has hidden the main window. macOS renders `iconPath` as a
 * template image (recolored automatically for the light/dark menu bar); other
 * platforms render it as-is.
 *
 * When `popover` is given, left-click toggles it and right-click shows the "Show/
 * Quit" menu (`Tray.popUpContextMenu` — the standard, cross-platform-consistent way
 * to show a menu imperatively on demand) instead of `setContextMenu()`, which — on
 * macOS specifically — claims *every* click, left or right, leaving no way to tell
 * them apart; that's also why this file's own previous version needed no left-click
 * handler at all on macOS (`setContextMenu` already handled it there) but did on
 * Windows/Linux (where it doesn't by default) — this replaces both of those
 * platform-specific paths with one that behaves the same way everywhere.
 */
export function createTray(options: CreateTrayOptions): Electron.Tray {
  const { iconPath, onShow, onQuit, popover, resolvePopoverScreenBounds } = options;

  const icon = nativeImage.createFromPath(iconPath);
  if (process.platform === "darwin") {
    icon.setTemplateImage(true);
  }

  const tray = new Tray(icon);
  tray.setToolTip("Last.fm Scrobbler");

  const menu = Menu.buildFromTemplate([
    { label: "Show Last.fm Scrobbler", click: () => { onShow(); } },
    { type: "separator" },
    { label: "Quit", click: () => { onQuit(); } },
  ]);

  if (popover && resolvePopoverScreenBounds) {
    tray.on("click", () => {
      if (popover.isVisible()) {
        popover.hide();
        return;
      }
      const trayBounds = tray.getBounds();
      const { x, y } = positionTrayPopover(
        trayBounds,
        TRAY_POPOVER_SIZE,
        resolvePopoverScreenBounds(trayBounds),
        process.platform,
      );
      popover.setPosition(x, y);
      popover.show();
      popover.focus();
    });
    tray.on("right-click", () => {
      tray.popUpContextMenu(menu);
    });
  } else {
    tray.setContextMenu(menu);
    // On Windows/Linux a left-click doesn't open the context menu by default (only
    // right-click does) — wire it to reopen the window directly, which is the
    // behavior users expect from a tray icon. On macOS, setContextMenu already makes
    // any click open the menu, so this listener simply never fires there.
    tray.on("click", () => { onShow(); });
  }

  return tray;
}

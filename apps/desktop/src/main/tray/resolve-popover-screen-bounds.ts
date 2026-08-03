import electron from "electron";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { screen } from "electron"`.
const { screen } = electron;

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

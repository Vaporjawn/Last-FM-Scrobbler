export interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Computes where the tray mini-player popover should appear relative to the tray
 * icon's own screen bounds (`Tray.getBounds()`) — centered under it horizontally,
 * matching how macOS/Windows tray popovers conventionally anchor.
 *
 * Vertical placement differs by platform because the tray/menu-bar lives on opposite
 * edges of the screen: macOS's menu bar is always at the *top*, so the popover opens
 * *below* the icon; Windows' taskbar (and most Linux desktop environments' system
 * tray) is conventionally at the *bottom*, so it opens *above* instead. This is a
 * reasonable default, not a guarantee — a user who's moved their Windows taskbar to
 * the top, or a Linux desktop with an unusual panel placement, would see the popover
 * open on the "wrong" side; there's no cross-platform Electron API to ask where the
 * taskbar/panel actually is, only where the tray icon itself is.
 *
 * Always clamped to `screenBounds` (the tray icon's own display, from
 * `screen.getDisplayNearestPoint()`) so the popover never opens partially or fully
 * off-screen — most likely for a tray icon near a display's left/right edge, where a
 * horizontally-centered popover would otherwise overhang past it.
 */
export function positionTrayPopover(
  trayBounds: Rectangle,
  popoverSize: Size,
  screenBounds: Rectangle,
  platform: NodeJS.Platform,
): { readonly x: number; readonly y: number } {
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - popoverSize.width / 2);
  const y =
    platform === "darwin"
      ? Math.round(trayBounds.y + trayBounds.height + 4)
      : Math.round(trayBounds.y - popoverSize.height - 4);

  const minX = screenBounds.x;
  const maxX = screenBounds.x + screenBounds.width - popoverSize.width;
  const minY = screenBounds.y;
  const maxY = screenBounds.y + screenBounds.height - popoverSize.height;

  return {
    x: Math.min(Math.max(x, minX), Math.max(minX, maxX)),
    y: Math.min(Math.max(y, minY), Math.max(minY, maxY)),
  };
}

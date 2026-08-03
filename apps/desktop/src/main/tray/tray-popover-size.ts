/** Small enough to feel like a quick glance, not a second copy of the main window —
 * roughly matches the reference menu-bar-app sizing (album art + two lines of text +
 * a couple of buttons) this popover is modeled on. Shared by `createTrayPopoverWindow`
 * (sets the actual window's dimensions) and `create-tray.ts` (needs the same
 * dimensions to compute where the popover should be positioned relative to the tray
 * icon, before the window itself is asked). */
export const TRAY_POPOVER_SIZE = { width: 320, height: 180 };

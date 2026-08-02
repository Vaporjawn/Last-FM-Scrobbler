import { describe, expect, it } from "vitest";
import { positionTrayPopover } from "../../../src/main/tray/position-tray-popover.js";

const SCREEN_BOUNDS = { x: 0, y: 0, width: 1440, height: 900 };
const POPOVER_SIZE = { width: 320, height: 180 };

describe("positionTrayPopover", () => {
  it("centers horizontally under the tray icon and opens below it on macOS", () => {
    // Deliberately near the screen's horizontal center, not an edge — isolates
    // "centers under the icon" from the separate clamping behavior covered below.
    const trayBounds = { x: 700, y: 0, width: 22, height: 22 };

    const result = positionTrayPopover(trayBounds, POPOVER_SIZE, SCREEN_BOUNDS, "darwin");

    expect(result.x).toBe(Math.round(700 + 22 / 2 - 320 / 2));
    expect(result.y).toBe(0 + 22 + 4);
  });

  it("opens above the tray icon on Windows", () => {
    const trayBounds = { x: 1300, y: 870, width: 22, height: 22 };

    const result = positionTrayPopover(trayBounds, POPOVER_SIZE, SCREEN_BOUNDS, "win32");

    expect(result.y).toBe(870 - 180 - 4);
  });

  it("opens above the tray icon on Linux, same as Windows", () => {
    const trayBounds = { x: 1300, y: 870, width: 22, height: 22 };

    const result = positionTrayPopover(trayBounds, POPOVER_SIZE, SCREEN_BOUNDS, "linux");

    expect(result.y).toBe(870 - 180 - 4);
  });

  it("clamps to the screen's right edge when the tray icon is near it", () => {
    const trayBounds = { x: 1430, y: 0, width: 22, height: 22 };

    const result = positionTrayPopover(trayBounds, POPOVER_SIZE, SCREEN_BOUNDS, "darwin");

    expect(result.x).toBe(SCREEN_BOUNDS.width - POPOVER_SIZE.width);
  });

  it("clamps to the screen's left edge when the tray icon is near it", () => {
    const trayBounds = { x: 0, y: 0, width: 22, height: 22 };

    const result = positionTrayPopover(trayBounds, POPOVER_SIZE, SCREEN_BOUNDS, "darwin");

    expect(result.x).toBe(SCREEN_BOUNDS.x);
  });

  it("accounts for a non-origin screen (a secondary display)", () => {
    const screenBounds = { x: 1440, y: 0, width: 1920, height: 1080 };
    const trayBounds = { x: 3300, y: 0, width: 22, height: 22 };

    const result = positionTrayPopover(trayBounds, POPOVER_SIZE, screenBounds, "darwin");

    expect(result.x).toBeGreaterThanOrEqual(screenBounds.x);
    expect(result.x + POPOVER_SIZE.width).toBeLessThanOrEqual(screenBounds.x + screenBounds.width);
  });
});

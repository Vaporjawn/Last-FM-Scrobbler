// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const screen = vi.hoisted(() => ({ getDisplayNearestPoint: vi.fn() }));

vi.mock("electron", () => ({ default: { screen } }));

import { resolvePopoverScreenBounds } from "../../../src/main/tray/resolve-popover-screen-bounds.js";

describe("resolvePopoverScreenBounds", () => {
  it("returns the bounds of the display nearest the tray icon's centre", () => {
    const bounds = { x: 1440, y: 0, width: 1920, height: 1080 };
    screen.getDisplayNearestPoint.mockReturnValue({ bounds });

    const result = resolvePopoverScreenBounds({ x: 1500, y: 0, width: 24, height: 22 });

    expect(screen.getDisplayNearestPoint).toHaveBeenCalledWith({ x: 1512, y: 11 });
    expect(result).toBe(bounds);
  });
});

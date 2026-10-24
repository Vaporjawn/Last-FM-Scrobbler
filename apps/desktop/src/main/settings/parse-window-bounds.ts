import { type WindowBounds } from "../../shared/settings-api.js";
import { isInteger } from "./is-integer.js";

/** Generous bounds for a window position/size, in pixels — far beyond any real display,
 * but small enough to keep a bad value from reaching the window manager. */
const MAX_WINDOW_SIZE = 16_384;
const MAX_WINDOW_COORDINATE = 65_536;

/**
 * Validates an untrusted value (from `settings.json` or an IPC patch) as window bounds:
 * integer `x`/`y`/`width`/`height` within the limits above and a positive size. Returns a
 * clean copy of the four fields, or `undefined` if anything is missing or out of range.
 */
export function parseWindowBounds(value: unknown): WindowBounds | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const { x, y, width, height } = value as Record<string, unknown>;
  if (
    !isInteger(x, MAX_WINDOW_COORDINATE) ||
    !isInteger(y, MAX_WINDOW_COORDINATE) ||
    !isInteger(width, MAX_WINDOW_SIZE) ||
    !isInteger(height, MAX_WINDOW_SIZE) ||
    width < 1 ||
    height < 1
  ) {
    return undefined;
  }
  return { x, y, width, height };
}

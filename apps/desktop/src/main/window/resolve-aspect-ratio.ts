import type { AspectRatioOption } from "../../shared/settings-api.js";

const ASPECT_RATIO_VALUES: Record<AspectRatioOption, number> = {
  free: 0,
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "1:1": 1,
  "9:16": 9 / 16,
  "9:14": 9 / 14,
};

/**
 * Converts a user-facing `AspectRatioOption` (see `shared/settings-api.ts`) into the
 * numeric width/height ratio `Electron.BrowserWindow.setAspectRatio()` expects. `0` —
 * `"free"`'s value — is also Electron's own documented way to disable a previously-set
 * aspect ratio, so passing this straight through to `setAspectRatio()` correctly
 * un-locks the window when the user picks "Free" after locking it to something else.
 */
export function resolveAspectRatioValue(option: AspectRatioOption): number {
  return ASPECT_RATIO_VALUES[option];
}

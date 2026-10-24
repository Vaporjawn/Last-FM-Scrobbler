import { type AspectRatioOption } from "./aspect-ratio-option.js";

/** Every valid `AspectRatioOption` value — the runtime companion to the type above,
 * since a type alone can't validate a value arriving from outside TypeScript-checked
 * code (an IPC payload from the renderer, a stale/corrupted persisted settings.json
 * from an older version of this app that supported a different set of options). See
 * `isAspectRatioOption` below for the actual validation check. */
export const ASPECT_RATIO_OPTIONS: readonly AspectRatioOption[] = [
  "free",
  "16:9",
  "4:3",
  "1:1",
  "9:16",
  "9:14",
];
/** Validates an unknown value as a real `AspectRatioOption` before it's trusted —
 * `main/settings/wire-settings.ts` uses this at the `settings:set` IPC boundary.
 * Without this check, an invalid value (typo'd, a removed option from an older
 * version, a malformed IPC payload) used to flow straight through
 * `main/window/resolve-aspect-ratio.ts`'s `Record` lookup as `undefined` — despite
 * that function's own return type claiming `number` — and cascade into `NaN` in the
 * native window-geometry math downstream (`computeMinimumSizeForAspectRatio`,
 * `BrowserWindow.setAspectRatio`/`setMinimumSize`). */
export function isAspectRatioOption(value: unknown): value is AspectRatioOption {
  return ASPECT_RATIO_OPTIONS.includes(value as AspectRatioOption);
}

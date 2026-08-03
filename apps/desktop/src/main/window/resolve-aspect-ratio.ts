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
 *
 * Falls back to `0` for anything that isn't actually a real `AspectRatioOption` key,
 * rather than trusting `option`'s declared type unconditionally: `wire-settings.ts`
 * validates before this is reached via the live settings IPC path, but this is the
 * single place every caller (present and future) gets that same protection for free,
 * rather than each one needing to remember its own `?? 0` fallback — an omitted one
 * previously let `undefined` cascade into `NaN` throughout the window-geometry math
 * anywhere this value flows (`computeMinimumSizeForAspectRatio`,
 * `BrowserWindow.setAspectRatio`/`setMinimumSize`).
 */
export function resolveAspectRatioValue(option: AspectRatioOption): number {
  // Looked up through a `Partial<Record<string, number>>`-typed reference, not
  // `ASPECT_RATIO_VALUES` directly — indexing the real `Record<AspectRatioOption,
  // number>` with `option`'s own declared type makes TypeScript itself believe this
  // lookup can never miss, which is exactly the false confidence this function exists
  // to not propagate; a plain `string` index signature is the one way to make the type
  // checker (and so the linter, and so this fallback) honestly reflect that only a
  // real runtime check — not the type checker — can verify a value actually reached
  // here as one of the six known options.
  const lookup: Partial<Record<string, number>> = ASPECT_RATIO_VALUES;
  return lookup[option] ?? 0;
}

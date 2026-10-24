import { type AspectRatioOption } from "./aspect-ratio-option.js";

/** `true` for `"9:16"`/`"9:14"` (width < height, see `AspectRatioOption`'s own
 * docstring), `false` for every landscape/square option and `"free"`. A plain set
 * check on the option string itself — deliberately not sharing
 * `main/window/resolve-aspect-ratio.ts`'s numeric `0 < value < 1` version, which
 * needs a `BrowserWindow`-ready numeric ratio Electron's `screen` APIs don't exist to
 * compute in the renderer; this one only needs the raw `AppSettings.aspectRatio`
 * value itself, so both processes can use whichever form they already have on hand
 * without one needing to import anything from the other. */
export function isPortraitAspectRatio(option: AspectRatioOption): boolean {
  return option === "9:16" || option === "9:14";
}

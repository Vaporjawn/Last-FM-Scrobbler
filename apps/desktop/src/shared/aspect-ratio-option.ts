/**
 * A user-selectable resize constraint for the main window — `"9:14"` is the default
 * (see `DEFAULT_APP_SETTINGS`), locking the window to a portrait shape out of the box;
 * `"free"` is unconstrained resizing, this app's *original* default before this
 * setting existed, still available as an explicit opt-out. `"9:16"` and `"9:14"` are
 * the only portrait options (width < height) — `"16:9"`/`"4:3"`/`"1:1"` are landscape
 * or square — which is why the immediate resize either of them triggers anchors on
 * this window's minimum width and derives a matching height, rather than anchoring on
 * the current width and deriving height the way the landscape/square options do; see
 * `main/window/compute-minimum-size-for-aspect-ratio.ts` and `main/window/
 * apply-aspect-ratio.ts` for that branch, and `create-main-window.ts` for how a
 * portrait default also changes this window's *initial* size on a fresh install (no
 * `windowBounds` saved yet). See `main/window/resolve-aspect-ratio.ts` for how any of
 * these becomes the numeric ratio `BrowserWindow.setAspectRatio()` expects.
 */
export type AspectRatioOption = "free" | "16:9" | "4:3" | "1:1" | "9:16" | "9:14";

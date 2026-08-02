/**
 * `BrowserWindow.setAspectRatio()` only constrains *future* manual resizing — it does
 * not itself resize the window to the new ratio (verified against Electron's own
 * docs: "This will not resize the window"). Picking a new ratio in Settings would
 * otherwise visually do nothing until the user happened to drag an edge, which reads
 * as "the setting doesn't work" even though it technically already applied. This
 * computes the height the window should snap to *right now*, keeping its current
 * width fixed as the anchor (matches how most apps that offer a "lock aspect ratio"
 * control behave — width stays put, height follows) and never resizing below
 * `minHeight` (this app's own window has a real minimum — see
 * `create-main-window.ts`'s `minHeight` — snapping to something smaller than that
 * would immediately violate it).
 *
 * `aspectRatioValue <= 0` is "free" (see `resolve-aspect-ratio.ts`) — nothing to snap
 * to, so the current height is returned unchanged.
 */
export function computeResizedHeight(
  currentWidth: number,
  currentHeight: number,
  aspectRatioValue: number,
  minHeight: number,
): number {
  if (aspectRatioValue <= 0) {
    return currentHeight;
  }
  return Math.max(minHeight, Math.round(currentWidth / aspectRatioValue));
}

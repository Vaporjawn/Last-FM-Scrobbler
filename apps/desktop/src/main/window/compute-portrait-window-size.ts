export interface ResizedWindowSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Computes the window size to snap to when the user picks a *portrait* aspect ratio
 * (currently only `"9:16"` — see `shared/settings-api.ts`'s `AspectRatioOption`). See
 * `compute-resized-height.ts`'s docstring for why an immediate resize is needed at all
 * (`setAspectRatio()` only constrains *future* manual resizing).
 *
 * Deliberately doesn't anchor on the window's *current* width the way
 * `computeResizedHeight` does for the other three (landscape/square) ratios: this
 * app's window starts out landscape-shaped (1100x720 default, or whatever the user
 * last resized it to), so keeping that width fixed and deriving a matching height from
 * a portrait ratio computes something taller than almost any real screen (e.g. 1100 /
 * (9/16) ≈ 1956px) — a window that mostly falls off the bottom of the screen doesn't
 * read as "went vertical," it reads as broken. Anchors on `minWidth` instead — the
 * narrowest this app's fixed-width sidebar+content layout supports (see
 * `create-main-window.ts`'s own `minWidth` comment for why 680 specifically) — and
 * derives a genuinely taller matching height from *that*, since going vertical is an
 * intentional, real shape change rather than a small ratio-preserving tweak to
 * whatever size the window already happened to be. This is the narrowest, most
 * convincingly portrait window this app's current layout can offer.
 *
 * `aspectRatioValue <= 0` is "free" (see `resolve-aspect-ratio.ts`) — nothing to snap
 * to, so the current size is returned unchanged, same convention as
 * `computeResizedHeight`.
 */
export function computePortraitWindowSize(
  currentWidth: number,
  currentHeight: number,
  aspectRatioValue: number,
  minWidth: number,
): ResizedWindowSize {
  if (aspectRatioValue <= 0) {
    return { width: currentWidth, height: currentHeight };
  }
  return { width: minWidth, height: Math.round(minWidth / aspectRatioValue) };
}

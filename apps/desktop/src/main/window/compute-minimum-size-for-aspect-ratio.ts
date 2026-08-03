export interface MinimumWindowSize {
  readonly width: number;
  readonly height: number;
}

/** Leaves real slack between the enforced minimum size and the screen's actual
 * capacity — see this file's own docstring for why an enforced minimum sitting flush
 * against (or over) the screen's edge broke resizing entirely, not just at the
 * boundary. */
const SCREEN_SAFETY_MARGIN = 0.9;

/**
 * Computes the minimum size to enforce (`BrowserWindow.setMinimumSize()`/the
 * constructor's `minWidth`/`minHeight`) for a given locked aspect ratio, so the OS's
 * minimum-size floor and its aspect-ratio constraint are always mutually consistent —
 * never two independent, conflicting floors.
 *
 * **Why this exists**: verified live against a real `BrowserWindow` on macOS that
 * dragging a resize handle inward, past whichever of `absoluteMinWidth`/
 * `absoluteMinHeight` the drag reaches *first*, while an aspect-ratio constraint is
 * simultaneously active, corrupts the resulting size completely — not just clamping to
 * the floor, but landing on a size bearing no relationship to either the requested
 * size or the locked ratio (reproduced: dragging a 9:14-locked window narrower than
 * its flat 680px minimum width produced 288×1090, an unrelated ~0.26 ratio instead of
 * 9:14 ≈ 0.64). This is exactly the scenario this app's own default settings create
 * out of the box: `AppSettings.aspectRatio` defaults to `"9:14"`, and the window's
 * flat content-driven floors (680 wide, 480 tall) are wildly disproportionate to that
 * ratio — a 680-wide window at 9:14 needs to be over 1000px tall, so the window
 * *starts* already sitting exactly at its own width floor, meaning literally the
 * first inward drag pixel hits the conflict. Making the two enforced floors
 * *proportional to the locked ratio* (so both are reached at the same moment, never
 * independently) avoids the conflict that triggers the corruption in the first place.
 *
 * **Why the screen-size clamp is load-bearing, not a nice-to-have**: naively deriving
 * a ratio-consistent minimum from the content floors alone can produce an enforced
 * minimum that's *taller than the screen itself* (e.g. a 9:14 ratio needs ~1090px of
 * height for a 680px-wide floor, which can exceed a smaller display's usable height
 * entirely). Verified live that this isn't just "too tall" — an enforced minimum
 * size the screen can't actually satisfy freezes *all* future resizing on that
 * window completely (zero resize events fired for *any* subsequent request, not just
 * ones near the broken boundary), because Cocoa has no valid frame left to compute at
 * all once "at least this big" and "fits on this screen" can't both hold. Scaling the
 * whole minimum down proportionally (preserving the exact ratio) when it would
 * otherwise exceed `SCREEN_SAFETY_MARGIN` of the available screen is what keeps the
 * window usable — even if that means going below the nominal content floor on a
 * genuinely small display, a slightly cramped-but-working window beats a frozen one.
 */
export function computeMinimumSizeForAspectRatio(
  aspectRatioValue: number,
  absoluteMinWidth: number,
  absoluteMinHeight: number,
  availableWidth: number,
  availableHeight: number,
): MinimumWindowSize {
  if (aspectRatioValue <= 0) {
    // "Free" (see resolve-aspect-ratio.ts) — no ratio to reconcile the two floors
    // against, so they're free to stay independent.
    return { width: absoluteMinWidth, height: absoluteMinHeight };
  }

  // Two candidates, each derived from ONE of the real content floors with the other
  // dimension following the ratio — exactly one of them will actually satisfy BOTH
  // floors simultaneously (the one anchored on whichever floor is more restrictive
  // for this particular ratio); the other would under-satisfy its own paired floor.
  const anchoredOnWidth: MinimumWindowSize = {
    width: absoluteMinWidth,
    height: Math.round(absoluteMinWidth / aspectRatioValue),
  };
  const anchoredOnHeight: MinimumWindowSize = {
    width: Math.round(absoluteMinHeight * aspectRatioValue),
    height: absoluteMinHeight,
  };
  const candidate =
    anchoredOnWidth.height >= absoluteMinHeight ? anchoredOnWidth : anchoredOnHeight;

  const maxWidth = Math.floor(availableWidth * SCREEN_SAFETY_MARGIN);
  const maxHeight = Math.floor(availableHeight * SCREEN_SAFETY_MARGIN);
  const scale = Math.min(1, maxWidth / candidate.width, maxHeight / candidate.height);
  if (scale >= 1) {
    return candidate;
  }

  // Scales both dimensions down by the same factor — preserves the exact ratio rather
  // than independently clamping each one, which would reintroduce the very
  // inconsistency this function exists to eliminate.
  return {
    width: Math.round(candidate.width * scale),
    height: Math.round(candidate.height * scale),
  };
}

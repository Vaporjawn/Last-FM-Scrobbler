import type { AspectRatioOption, WindowBounds } from "../../shared/settings-api.js";
import { computeMinimumSizeForAspectRatio } from "./compute-minimum-size-for-aspect-ratio.js";
import { computeResizedHeight } from "./compute-resized-height.js";
import { resolveAspectRatioValue } from "./resolve-aspect-ratio.js";

/** The subset of `Electron.BrowserWindow` this needs — narrowed for easy testing,
 * same convention as `persist-window-bounds.ts`'s `BoundsTrackedWindow`. */
export interface AspectRatioTargetWindow {
  readonly setAspectRatio: (value: number) => void;
  readonly setMinimumSize: (width: number, height: number) => void;
  readonly getBounds: () => WindowBounds;
  readonly setSize: (width: number, height: number) => void;
}

export interface ApplyAspectRatioOptions {
  /** This app's real, content-driven size floors — see `create-main-window.ts`'s
   * `minWidth`/`minHeight` for why these specific numbers. Not necessarily what ends
   * up enforced: see `computeMinimumSizeForAspectRatio`. */
  readonly minWidth: number;
  readonly minHeight: number;
  /** The current display's usable work area (`Electron.screen.getDisplayMatching(
   * window.getBounds()).workArea`) — real callers must pass this fresh on every call,
   * not a cached value, since the window (and therefore which display it's on) can
   * move between calls. Required by `computeMinimumSizeForAspectRatio` to keep the
   * enforced minimum size from exceeding what the current screen can actually fit. */
  readonly availableWidth: number;
  readonly availableHeight: number;
}

/**
 * Applies a Settings → Window aspect-ratio change to an already-open window, resizing
 * it to snap to the new ratio immediately (`setAspectRatio()` alone only *constrains
 * future manual resizing* — Electron's own docs: "This will not resize the window" —
 * so without an explicit resize, picking a new ratio would visually do nothing until
 * the user happened to drag an edge).
 *
 * **Always clears the window's aspect-ratio constraint (`setAspectRatio(0)`) before
 * computing or applying that resize, then reapplies the real target ratio only once
 * the resize is done** — this order is load-bearing, not stylistic. Verified live
 * against a real `BrowserWindow` on macOS: calling `setSize()` while *any* aspect-ratio
 * constraint is already active (either the target one, or one left over from a
 * previous call) and the requested size needs clamping against the screen's available
 * work area, Cocoa's constrained-resize path (`windowWillResize:toSize:`) computes a
 * corrupted final size — not the requested size, and not matching the target ratio at
 * all (reproduced case: requesting 680×1209 on a 1010px-tall screen produced
 * 252×1241, an unrelated ~0.20 ratio instead of the intended 9:16 ≈ 0.56). This
 * matches several long-standing upstream reports of `setAspectRatio`/resize
 * interactions misbehaving on macOS when a resize hits a size boundary (e.g.
 * electron/electron#50367, #20618, #29100) — clearing the constraint first sidesteps
 * the buggy code path entirely: with no aspect ratio active, `setSize()` just clamps
 * cleanly to the screen like any other resize, verified to produce a stable, sane
 * result across repeated ratio switches (including switching directly between two
 * portrait ratios, where the *previous* ratio being left active during the next
 * resize was independently confirmed to reproduce the same corruption).
 *
 * **Also recomputes and applies the window's minimum size on every call, via
 * `computeMinimumSizeForAspectRatio` rather than the raw `minWidth`/`minHeight`
 * floors** — this is a *second*, distinct bug this function fixes, not just the one
 * above. The same native corruption also fires during a real, interactive user drag
 * (not just this function's own programmatic resize), the moment the drag crosses
 * whichever of the flat `minWidth`/`minHeight` floors it reaches first while the
 * aspect ratio stays locked throughout (which it always does during a manual drag —
 * unlike this function's own resize, there's no opportunity to clear the constraint
 * first). Verified live that this isn't a rare edge case: this app's default
 * (`"9:14"`) starts the window already sitting exactly at its flat 680px width floor,
 * so literally the first inward drag pixel triggers it. Enforcing a minimum size
 * that's *proportional to the locked ratio* (so both floors are reached at the same
 * moment, never independently) removes the conflict that triggers the corruption in
 * the first place — see that function's own docstring for the full reasoning,
 * including why the enforced minimum also has to stay within the current screen's
 * actual capacity (an oversized minimum was independently verified to freeze all
 * future resizing entirely, not just resizing near the boundary).
 */
export function applyAspectRatio(
  window: AspectRatioTargetWindow,
  aspectRatio: AspectRatioOption,
  options: ApplyAspectRatioOptions,
): void {
  const { minWidth, minHeight, availableWidth, availableHeight } = options;
  // Safe against an invalid `aspectRatio` even if this is ever reached without
  // `wire-settings.ts`'s own IPC-boundary validation — see `resolveAspectRatioValue`'s
  // docstring for why it, not each caller, owns the fallback-to-0 guard.
  const aspectRatioValue = resolveAspectRatioValue(aspectRatio);

  window.setAspectRatio(0);

  const minimumSize = computeMinimumSizeForAspectRatio(
    aspectRatioValue,
    minWidth,
    minHeight,
    availableWidth,
    availableHeight,
  );
  window.setMinimumSize(minimumSize.width, minimumSize.height);

  const bounds = window.getBounds();
  if (aspectRatioValue > 0 && aspectRatioValue < 1) {
    // Portrait ("9:16"/"9:14" — see AppSettings.aspectRatio's docstring): snaps
    // directly to `minimumSize` — deliberately doesn't anchor on the window's
    // *current* width the way the landscape/square branch below does: someone
    // switching from, say, "16:9" (or just manually resized wide) could easily have a
    // window a good deal wider than this app's 1100-wide default, so keeping that
    // width fixed and deriving a matching height from a portrait ratio can compute
    // something taller than almost any real screen. `minimumSize` is already both
    // ratio-consistent and screen-safe (see computeMinimumSizeForAspectRatio), so
    // it's the correct target directly — no separate derivation needed.
    if (minimumSize.width !== bounds.width || minimumSize.height !== bounds.height) {
      window.setSize(minimumSize.width, minimumSize.height);
    }
  } else {
    // Landscape or square — keeps the current width fixed and derives height from it
    // (see computeResizedHeight's docstring). A no-op for "free" (aspectRatioValue
    // <= 0): computeResizedHeight returns the current height unchanged, so this never
    // calls setSize — correctly leaves the current size alone, just unlocked.
    const resizedHeight = computeResizedHeight(
      bounds.width,
      bounds.height,
      aspectRatioValue,
      minimumSize.height,
    );
    if (resizedHeight !== bounds.height) {
      window.setSize(bounds.width, resizedHeight);
    }
  }

  window.setAspectRatio(aspectRatioValue);
}

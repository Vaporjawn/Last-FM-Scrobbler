/** The handful of colors `ErrorBoundaryFallback` needs — plain inline styles, not MUI
 * theme tokens, since (per `ErrorBoundary.tsx`'s own docstring) MUI's theme context
 * isn't guaranteed to be available at the point that fallback renders. */
export interface ErrorBoundaryColors {
  readonly background: string;
  readonly text: string;
  readonly subtleText: string;
  readonly panelBackground: string;
  readonly panelText: string;
}

/** Dark-mode colors — this app's original, and only, look before `AppSettings
 * .themeMode` existed: `#0f0c0b` is `theme/index.ts`'s real `DARK_BACKGROUND.default`
 * (not MUI's generic `#121212`), pure white text, translucent-white for the subtler
 * copy and the error-detail panel. */
const DARK_COLORS: ErrorBoundaryColors = {
  background: "#0f0c0b",
  text: "#fff",
  subtleText: "rgba(255,255,255,0.7)",
  panelBackground: "rgba(255,255,255,0.06)",
  panelText: "rgba(255,255,255,0.5)",
};

/** Light-mode colors — `#faf8f5` is `theme/index.ts`'s real `LIGHT_BACKGROUND
 * .default`; `#1a120c` (and its rgba variants below) is that same file's
 * `palette.secondary.contrastText`, a warm dark near-black hand-picked there for
 * exactly this "dark text that needs to read clearly on a light warm background"
 * job — reused here rather than an arbitrary pure black, so this fallback screen
 * still reads as *this app's* light mode, not a generic one. */
const LIGHT_COLORS: ErrorBoundaryColors = {
  background: "#faf8f5",
  text: "#1a120c",
  subtleText: "rgba(26,18,12,0.7)",
  panelBackground: "rgba(26,18,12,0.06)",
  panelText: "rgba(26,18,12,0.6)",
};

/** Picks `ErrorBoundaryFallback`'s colors for the given theme — see that component for
 * where `isLight` actually comes from (`<html>`'s `data-theme` attribute, set before
 * React ever mounts — see `renderer/public/theme-init.js`). */
export function resolveErrorBoundaryColors(isLight: boolean): ErrorBoundaryColors {
  return isLight ? LIGHT_COLORS : DARK_COLORS;
}

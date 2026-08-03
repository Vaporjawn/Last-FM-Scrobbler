import { NAV_ITEMS, SETTINGS_ITEM, type ViewId } from "./nav-items.js";

/** The sidebar's own display label for a view — exported so `App.tsx` can build a
 * context-aware "Back to {label}" for `ScrobbleDetailPage` (reachable from more than
 * one view's list now — see `PageProps.onSelectScrobble`) without a second, separately
 * maintained id-to-label mapping drifting from this one. */
export function getViewLabel(view: ViewId): string {
  return view === "settings"
    ? SETTINGS_ITEM.label
    : (NAV_ITEMS.find((item) => item.id === view)?.label ?? view);
}

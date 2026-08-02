/**
 * Common props `App.tsx` passes to every view (see `PAGES` there). Pages that don't
 * need a given callback simply don't destructure it; a component that takes fewer
 * props (including zero) is still assignable to this shape.
 */
export interface PageProps {
  /** Switches the active view to Preferences — used by pages that need an active
   * Last.fm account before they have anything to show (see `LoginPrompt`). */
  readonly onNavigateToPreferences: () => void;
  /** Switches the active view to Profile — used by `PreferencesPage` right after a
   * successful login, so the user immediately sees confirmation of who they're now
   * logged in as rather than staying on a plain account-picker list. Optional (unlike
   * `onNavigateToPreferences` above) so pages that don't call it don't need to thread
   * it through their own test fakes. */
  readonly onNavigateToProfile?: () => void;
}

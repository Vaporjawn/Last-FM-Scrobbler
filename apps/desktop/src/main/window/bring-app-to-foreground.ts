/** The subset of `Electron.BrowserWindow` this needs — narrowed for easy testing.
 * Arrow-function-property syntax (not method shorthand) so tests can reference e.g.
 * `window.restore` directly in assertions without tripping
 * `@typescript-eslint/unbound-method`. */
export interface ForegroundableWindow {
  readonly isMinimized: () => boolean;
  readonly restore: () => void;
  readonly show: () => void;
  readonly moveTop: () => void;
  readonly focus: () => void;
  /** Flashes the taskbar icon on Windows/Linux — a no-op on an already-focused
   * window, and generally a no-op on macOS (which uses the dock instead). */
  readonly flashFrame: (flag: boolean) => void;
}

/** The subset of Electron's `app` this needs. `dock` is `undefined`/`null` on every
 * platform except macOS — see Electron's own `app.dock` docs. */
export interface ForegroundableApp {
  readonly focus: (options?: { steal: boolean }) => void;
  readonly dock?:
    | { readonly bounce: (type?: "critical" | "informational") => number }
    | null
    | undefined;
}

/**
 * Best-effort "get this window in front of the user" — used right after a Last.fm
 * login completes, since the user was just sent away to their own browser for the
 * "Allow Access" step and there's no other signal telling them to come back.
 *
 * There is no way to *guarantee* this actually works: macOS in particular treats
 * focus-stealing by a background app as something to actively resist (Electron's own
 * docs on `app.focus({steal: true})` call it macOS-only and say to "use it as
 * sparingly as possible"), and behavior can vary further with the user's Focus/Do Not
 * Disturb settings or window-manager choice on Linux. What *is* verifiable — and
 * covered by this module's tests — is that every one of these calls actually happens,
 * in the right order, given a window: `app.focus({steal: true})` **before**
 * `window.show()` (the OS-level "who's allowed to be active" decision has to happen
 * before a window can meaningfully claim focus, not after), then
 * `restore()`-if-minimized, `show()`, `moveTop()`, `focus()`, and finally a dock
 * bounce / taskbar flash that — unlike the focus calls above — doesn't require any
 * special permission and reliably gets the user's attention even when hard
 * focus-stealing doesn't take. `main/index.ts` also fires a native OS notification
 * alongside this (see `notifications/show-notification.ts`), which is the one signal
 * in this whole chain that's genuinely guaranteed to appear regardless of focus.
 */
export function bringAppToForeground(app: ForegroundableApp, window: ForegroundableWindow): void {
  app.focus({ steal: true });
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.moveTop();
  window.focus();
  app.dock?.bounce("critical");
  window.flashFrame(true);
}

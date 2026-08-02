import electron from "electron";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { Notification } from "electron"`.
const { Notification } = electron;

export interface ShowNotificationOptions {
  readonly title: string;
  readonly body: string;
  /** Absolute path to an icon file — see `resolve-app-icon-path.ts`. Falls back to
   * the OS's own default (the app's bundle icon on a packaged build; a generic
   * Electron icon in dev) when omitted. */
  readonly icon?: string;
  /** Called if the user clicks the notification itself (not a platform-specific
   * action button — Electron's `actions` option is macOS-only and not used here, to
   * keep behavior consistent across platforms). */
  readonly onClick?: () => void;
}

/**
 * Shows a native OS notification — the toast/banner style alert (Notification
 * Center on macOS, Action Center on Windows, whatever the desktop environment
 * provides on Linux via libnotify/D-Bus), as opposed to `dialog.showMessageBox`'s
 * blocking modal dialog (see `main/updates/show-restart-prompt.ts` for that, used
 * instead of this when a decision needs to be collected before continuing).
 *
 * This is for events that happen unattended, often with the main window hidden (see
 * docs/modules/desktop.md's "Background app" section) — a scrobble submitted, an
 * update found, the app quietly going to the tray for the first time — where there's
 * nothing to decide and no in-app UI is guaranteed to be visible to show a snackbar
 * in instead.
 *
 * No-ops (does not throw) when `Notification.isSupported()` is false — e.g. a Linux
 * desktop with no notification daemon running, the same category of "environment may
 * not have this OS feature" caveat this project already applies to `safeStorage`'s
 * keyring dependency (see docs/modules/desktop.md's Linux note in "Login UX"), or an
 * unsigned/ad-hoc dev build that macOS hasn't fully registered for Notification
 * Center. That "unsupported" case used to be entirely silent — nothing in a log or
 * console said a notification was skipped, which made it indistinguishable from "the
 * code that calls this was never reached at all" when something downstream (e.g. the
 * login flow) appeared to produce no visible signal whatsoever. Logging it here, right
 * at the one chokepoint every caller goes through, closes that gap for every feature
 * that uses this module, not just the one that happened to go looking.
 */
export function showNotification(options: ShowNotificationOptions): void {
  if (!Notification.isSupported()) {
    // This module has no injected logger (see main/index.ts's own Logger, which
    // callers already have and can use *in addition* to this) — a bare console line
    // is the only diagnostic available at this layer.
    console.warn(`showNotification: skipped ("${options.title}") — Notification.isSupported() is false.`);
    return;
  }

  const notification = new Notification({
    title: options.title,
    body: options.body,
    ...(options.icon ? { icon: options.icon } : {}),
  });

  if (options.onClick) {
    notification.on("click", options.onClick);
  }

  notification.show();
}

import electron from "electron";
import type { Logger } from "@lastfm-scrobbler/core";
import { showNotification } from "../notifications/show-notification.js";
import { bringAppToForeground } from "../window/bring-app-to-foreground.js";

const { app, BrowserWindow } = electron;

/** What `announceLoginSuccess` needs to log and notify for one service. */
export interface AnnounceLoginSuccessOptions {
  readonly logger: Logger;
  /** Names the login in log lines, e.g. `Login` or `Libre.fm login`. */
  readonly logLabel: string;
  readonly username: string;
  readonly notificationTitle: string;
  readonly notificationBody: string;
  /** Spread into the notification; carries the dev icon when there is one. */
  readonly notificationIconOption: { readonly icon?: string };
}

/**
 * Brings the app back to the front after a browser-based login completes, and shows a native
 * notification. The user was just sent to their own browser for the service's "Allow Access"
 * step, so this lands them somewhere useful instead of making them switch back by hand.
 *
 * The window is looked up fresh via `getAllWindows()` rather than closed over, since the main
 * window does not exist yet when the login handlers are wired. The notification fires
 * alongside the focus attempt, not instead of it: it is the one signal guaranteed to appear
 * regardless of focus, Do Not Disturb or window-manager quirks (see
 * `bring-app-to-foreground.ts`), and clicking it re-runs the same foreground logic.
 */
export function announceLoginSuccess(options: AnnounceLoginSuccessOptions): void {
  const { logger, logLabel, username, notificationTitle, notificationBody } = options;
  logger.info(`${logLabel} succeeded (${username}) — bringing the app to the foreground.`);
  const [window] = BrowserWindow.getAllWindows();
  if (window) {
    bringAppToForeground(app, window);
  } else {
    logger.warn(`${logLabel} succeeded but no window exists to bring forward.`);
  }
  showNotification({
    title: notificationTitle,
    body: notificationBody,
    ...options.notificationIconOption,
    onClick: () => {
      const [clickedWindow] = BrowserWindow.getAllWindows();
      if (clickedWindow) {
        bringAppToForeground(app, clickedWindow);
      }
    },
  });
}

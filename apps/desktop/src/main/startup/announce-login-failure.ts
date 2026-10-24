import type { Logger } from "@lastfm-scrobbler/core";
import { showNotification } from "../notifications/show-notification.js";

/** What `announceLoginFailure` needs to log and notify for one service. */
export interface AnnounceLoginFailureOptions {
  readonly logger: Logger;
  /** Names the login in the log line, e.g. `Login` or `Libre.fm login`. */
  readonly logLabel: string;
  readonly message: string;
  readonly notificationTitle: string;
  /** Spread into the notification; carries the dev icon when there is one. */
  readonly notificationIconOption: { readonly icon?: string };
}

/**
 * Logs a failed login and shows a native notification. A service's desktop-auth flow has no
 * callback or redirect, so a failure (most often a timeout because nobody clicked "Allow
 * Access") can happen long after the user switched to their browser, with no window visible to
 * show the usual in-app error in. A native notification is the one signal that still reaches
 * them.
 */
export function announceLoginFailure(options: AnnounceLoginFailureOptions): void {
  options.logger.warn(`${options.logLabel} failed — ${options.message}`);
  showNotification({
    title: options.notificationTitle,
    body: options.message,
    ...options.notificationIconOption,
  });
}

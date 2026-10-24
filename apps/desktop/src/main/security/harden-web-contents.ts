import { isTrustedUrl } from "./is-trusted-url.js";
import { isSafeExternalUrl } from "../window/is-safe-external-url.js";

/** The page `hardenWebContents` allows a window to stay on and how it opens links elsewhere. */
export interface HardenWebContentsOptions {
  /** The renderer page this window is allowed to show — see `resolveExpectedRendererOrigin`. */
  readonly expectedOrigin: string;
  /** Hands a URL to the user's real browser. Only ever called with an http(s) URL. */
  readonly openExternal: (url: string) => void;
}

/**
 * Locks a window's web contents to this app's own renderer page, so nothing that ends up
 * in the page (a link built from a Last.fm API response, a future dependency) can turn it
 * into a window onto remote content that shares the preload bridge:
 *
 * - **Navigation**: `will-navigate` / `will-redirect` to anything but the app's own page
 *   is cancelled; a plain link click to a web page opens it in the real browser instead.
 * - **New windows**: always denied; http(s) targets open in the real browser.
 * - **`<webview>`**: attaching one is refused.
 * - **Permissions**: Electron grants every permission request (camera, microphone,
 *   geolocation, notifications, ...) unless a handler says otherwise. This app needs
 *   none of them, so every request and check is answered "no".
 *
 * Electron's security checklist covers each of these (items on navigation, new windows,
 * webview tags and permission requests).
 */
export function hardenWebContents(
  webContents: Electron.WebContents,
  options: HardenWebContentsOptions,
): void {
  const { expectedOrigin, openExternal } = options;

  webContents.on("will-navigate", (event, url) => {
    if (isTrustedUrl(url, expectedOrigin)) {
      return;
    }
    event.preventDefault();
    if (isSafeExternalUrl(url)) {
      openExternal(url);
    }
  });

  webContents.on("will-redirect", (event, url) => {
    if (!isTrustedUrl(url, expectedOrigin)) {
      event.preventDefault();
    }
  });

  webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      openExternal(url);
    }
    return { action: "deny" };
  });

  webContents.session.setPermissionRequestHandler((_requester, _permission, callback) => {
    callback(false);
  });
  webContents.session.setPermissionCheckHandler(() => false);
}

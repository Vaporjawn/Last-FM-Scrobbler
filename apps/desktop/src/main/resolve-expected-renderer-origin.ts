import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Computes the value `validate-ipc-sender.ts`'s `assertTrustedSender` should treat as
 * "this app's own renderer" — mirrors `create-main-window.ts`'s own dev/packaged
 * branch (`devServerUrl` from `ELECTRON_RENDERER_URL`, else `renderer/index.html` next
 * to `rendererDirname`) exactly, so this always agrees with whichever page
 * `mainWindow` actually loaded.
 *
 * Dev returns a real origin (e.g. `"http://localhost:5173"`) — safe to compare via
 * plain `URL#origin`. Packaged returns the renderer's real `file:` URL rather than the
 * string `"null"` that URL's own RFC-6454 `origin` getter would report for it (every
 * `file:` URL reports that same origin, regardless of path — see
 * `validate-ipc-sender.ts`'s docstring) precisely so `assertTrustedSender` has a real
 * pathname to compare against instead.
 */
export function resolveExpectedRendererOrigin(
  rendererDirname: string,
  devServerUrl: string | undefined,
): string {
  if (devServerUrl) {
    return new URL(devServerUrl).origin;
  }
  return pathToFileURL(join(rendererDirname, "../renderer/index.html")).href;
}

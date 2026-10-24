import { isTrustedUrl } from "./is-trusted-url.js";

/**
 * Defense-in-depth `ipcMain.handle()` guard: throws unless the call's `senderFrame`
 * genuinely matches this app's own renderer. Every IPC handler registers through it (see
 * `ipc/handle-trusted.ts`). `contextIsolation` is on, `nodeIntegration` is off and
 * `security/harden-web-contents.ts` blocks navigation, so untrusted content should never
 * end up sharing a window's IPC surface in normal operation — but Electron's own security
 * checklist lists sender validation as standard practice for the regressions that would
 * change that (a dependency loading remote content, a future feature adding an iframe),
 * and a handler that quietly skips it is exactly the one that turns such a regression
 * into a real hole.
 *
 * **The `file:` origin gotcha this exists to get right**: per RFC 6454, a URL with no
 * scheme/host/port triple — which includes every `file:` URL — serializes to the
 * literal string `"null"` as its origin, and *every* `file:` URL does, regardless of
 * path. Verified directly (not assumed): `new URL("file:///a").origin ===
 * new URL("file:///b").origin === "null"`, and Electron's own `WebFrameMain.origin`
 * docs confirm the same RFC 6454 behavior. A naive `senderUrl.origin ===
 * expectedOrigin` compare would therefore accept a call from *any* local file, not
 * just this app's own packaged `renderer/index.html` — silently defeating the whole
 * point of this check in a packaged build. `expectedOrigin` being a real `file:` URL
 * (not the string `"null"` — see `resolve-expected-renderer-origin.ts`) is what lets
 * `isTrustedUrl` fall back to a full pathname compare specifically for that case.
 */
export function assertTrustedSender(
  event: { readonly senderFrame: { readonly url: string } | null },
  expectedOrigin: string,
): void {
  if (!event.senderFrame) {
    throw new Error("Refusing IPC call with no senderFrame.");
  }

  if (!isTrustedUrl(event.senderFrame.url, expectedOrigin)) {
    throw new Error(`Refusing IPC call from untrusted sender: ${event.senderFrame.url}`);
  }
}

/**
 * Defense-in-depth `ipcMain.handle()` guard: throws unless the call's `senderFrame`
 * genuinely matches this app's own renderer. Not currently protecting against anything
 * exploitable today — `contextIsolation` is on, `nodeIntegration` is off, and
 * `create-main-window.ts`'s `setWindowOpenHandler` denies every attempt to open a new
 * window/navigate elsewhere, so untrusted content should never end up sharing this
 * window's IPC surface in normal operation. Electron's own security checklist still
 * lists sender validation as standard practice specifically for the regressions this
 * guards against instead (a dependency accidentally loading remote content, a future
 * feature adding an iframe, etc.) — see the highest-privilege/highest-side-effect
 * handler modules this is actually wired into: `auth/wire-auth.ts`,
 * `auth/wire-secondary-auth.ts`, and `lastfm/wire-track-actions.ts` check it on every
 * `ipcMain.handle` they register; `bug-report/wire-bug-report.ts` checks it only on
 * `bugReportSubmit` (the one handler there with a real external side effect — filing a
 * GitHub issue via the relay — unlike its sibling `bugReportIsConfigured`, a plain read).
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
 * this function fall back to a full pathname compare specifically for that case.
 */
export function assertTrustedSender(
  event: { readonly senderFrame: { readonly url: string } | null },
  expectedOrigin: string,
): void {
  if (!event.senderFrame) {
    throw new Error("Refusing IPC call with no senderFrame.");
  }

  const senderUrl = new URL(event.senderFrame.url);
  const expected = new URL(expectedOrigin);

  const trusted =
    expected.protocol === "file:"
      ? senderUrl.protocol === "file:" && senderUrl.pathname === expected.pathname
      : senderUrl.origin === expected.origin;

  if (!trusted) {
    throw new Error(`Refusing IPC call from untrusted sender: ${event.senderFrame.url}`);
  }
}

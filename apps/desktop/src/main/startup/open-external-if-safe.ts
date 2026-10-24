import electron from "electron";
import { isSafeExternalUrl } from "../window/is-safe-external-url.js";

const { shell } = electron;

/**
 * Shared `openUrl` implementation for `wireAuth`/`wireSecondaryAuth` below — opens the
 * Last.fm/Libre.fm "authorize this app" page in the user's real default browser.
 * `create-main-window.ts`'s `setWindowOpenHandler` already gates every *other*
 * `shell.openExternal` call in this app through `isSafeExternalUrl` first (renderer-
 * rendered links are built from external, unsanitized data — a Last.fm API response,
 * the bug-report relay's response — so Electron's own security guidance says not to
 * hand them to `shell.openExternal` unchecked); this call site was the one exception.
 * Traced where this particular URL actually comes from (`AuthFlow.authenticate()` →
 * `this.openUrl(this.client.buildAuthUrl(token))`, see
 * `packages/core/src/auth/auth-flow.ts`): always a fixed, hardcoded Last.fm/Libre.fm
 * host plus this build's own baked-in `api_key` plus an opaque token value Last.fm's/
 * Libre.fm's own API just returned — never attacker- or renderer-influenced data, so
 * this specific call site was never exploitable. Applied the same gate here anyway,
 * for the same reason `security/assert-trusted-sender.ts` describes its own checks as
 * defense-in-depth: regression-proofing against a *future* change to either call
 * site, not a response to a live vulnerability.
 */
export function openExternalIfSafe(url: string): void {
  if (isSafeExternalUrl(url)) {
    void shell.openExternal(url);
  }
}

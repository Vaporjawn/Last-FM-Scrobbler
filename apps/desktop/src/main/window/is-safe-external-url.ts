/**
 * Whether `url` is safe to hand to `shell.openExternal()` — `true` only for a
 * well-formed `http:`/`https:` URL. `create-main-window.ts`'s `setWindowOpenHandler`
 * calls this before opening anything, because several renderer components render
 * `target="_blank"` links built from external, unsanitized data (Last.fm API
 * responses, the bug-report relay's HTTP response) — Electron's own security
 * checklist warns against handing `shell.openExternal` untrusted content: a crafted
 * `file:`/`javascript:`/custom-protocol URL can trigger unintended local behavior
 * depending on platform and what's registered as a handler for it. Any other scheme,
 * or a string that isn't even a valid URL, returns `false`.
 */
export function isSafeExternalUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" || parsed.protocol === "http:";
}

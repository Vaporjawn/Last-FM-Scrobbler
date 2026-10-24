/**
 * Whether `url` is one of this app's own renderer pages. A packaged build serves exactly
 * one file (`expectedOrigin` is that file's `file:` URL, and the page's hash/query are
 * ignored); a dev build serves from one origin.
 */
export function isTrustedUrl(url: string, expectedOrigin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const expected = new URL(expectedOrigin);

  return expected.protocol === "file:"
    ? parsed.protocol === "file:" && parsed.pathname === expected.pathname
    : parsed.origin === expected.origin;
}

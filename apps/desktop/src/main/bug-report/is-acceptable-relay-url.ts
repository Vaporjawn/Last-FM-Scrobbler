/**
 * Whether `value` is somewhere reports (and the diagnostics bundled with them: recent log
 * lines) may be sent: an https URL, or plain http only to this machine for development.
 * Anything else — a typo'd scheme, a cleartext remote host — is treated as "not
 * configured" rather than sent in the clear.
 */
export function isAcceptableRelayUrl(value: string | undefined): value is string {
  if (!value) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") {
    return true;
  }
  return (
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]")
  );
}

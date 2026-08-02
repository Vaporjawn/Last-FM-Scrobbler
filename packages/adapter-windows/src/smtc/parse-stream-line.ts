import type { NowPlayingPayload } from "./now-playing-payload.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses one line of `SmtcHelper` stdout.
 *
 * Returns:
 * - a `NowPlayingPayload` object for a well-formed snapshot line,
 * - `null` for a literal JSON `null` line — SMTC's own signal that nothing is
 *   currently the "current session" (a real, meaningful state, not an error),
 * - `undefined` for anything unparseable (blank lines, malformed JSON, a stray
 *   diagnostic string) — the caller should skip these and leave state unchanged,
 *   since a single bad line should never be treated the same as "nothing playing".
 */
export function parseStreamLine(line: string): NowPlayingPayload | null | undefined {
  const trimmed = line.trim();
  if (trimmed === "") {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return undefined;
  }

  if (parsed === null) {
    return null;
  }
  if (!isPlainObject(parsed)) {
    return undefined;
  }
  return parsed;
}

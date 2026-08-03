import type { BugReportRequest } from "./bug-report-request.js";

/** GitHub's own real API limit for an issue title (verified against their validation
 * error: "title is too long (maximum is 256 characters)") — matching it exactly means
 * no genuinely valid report is ever rejected here that GitHub would have accepted. */
const MAX_TITLE_LENGTH = 256;
/** Comfortably under GitHub's own real issue-body limit (65536 characters) rather than
 * matching it exactly — `formatIssueBody` appends a diagnostics section and a fixed
 * disclaimer to `body`, so the *final* posted body is always somewhat longer than this
 * value; the gap is headroom for that, not slack for oversized reports. */
const MAX_BODY_LENGTH = 60_000;
/** Per-value cap for `diagnostics` — generous for real diagnostics (e.g. the desktop
 * app's own `recentLogs`, a bounded 50-line ring buffer, comes nowhere close), but
 * still a real bound rather than none at all. */
const MAX_DIAGNOSTIC_VALUE_LENGTH = 10_000;
/** Bounds the "many small values" variant of the same problem a single long value
 * would otherwise be the only thing capped against. */
const MAX_DIAGNOSTIC_KEYS = 20;

/**
 * Validates and normalizes an incoming JSON request body into a `BugReportRequest` —
 * throws a descriptive `Error` for anything malformed, which `index.ts`'s `fetch`
 * handler turns into a 400 response.
 *
 * This relay is reachable by anyone on the internet with no authentication at all, by
 * design (see docs/adr/0004-anonymous-bug-report-relay.md) — the length checks below
 * exist for that reason specifically. Without them, a caller (not necessarily the
 * well-behaved Electron client, which always sends bounded diagnostics — anyone who
 * can reach this URL directly) could send an arbitrarily large `title`/`body`/
 * `diagnostics` value; this Worker would fully buffer and forward all of it to
 * GitHub's Issues API before GitHub's own server-side limits eventually rejected it,
 * paying the full cost (Worker CPU time, egress bandwidth, a wasted call against the
 * shared GitHub PAT) of processing a request that was always going to fail. Rejecting
 * oversized input immediately, before any of that work happens, closes that off.
 */
export function parseBugReportRequest(payload: unknown): BugReportRequest {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Request body must be a JSON object");
  }

  const { title, body, diagnostics } = payload as Record<string, unknown>;

  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("`title` is required and must be a non-empty string");
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new Error(`\`title\` must be ${MAX_TITLE_LENGTH} characters or fewer`);
  }

  if (typeof body !== "string" || body.trim().length === 0) {
    throw new Error("`body` is required and must be a non-empty string");
  }
  if (body.length > MAX_BODY_LENGTH) {
    throw new Error(`\`body\` must be ${MAX_BODY_LENGTH} characters or fewer`);
  }

  if (diagnostics !== undefined) {
    // `Array.isArray` check is load-bearing, not redundant with the `typeof` check
    // above — `typeof [] === "object"` is `true` in JS, so an array payload
    // (`diagnostics: ["a", "b"]`) would otherwise pass as-is and later be silently
    // reinterpreted as `{"0":"a","1":"b"}` by `Object.entries`, diverging from the
    // declared `Record<string, string>` type without ever being rejected.
    if (typeof diagnostics !== "object" || diagnostics === null || Array.isArray(diagnostics)) {
      throw new Error("`diagnostics` must be an object of string values when present");
    }
    const entries = Object.entries(diagnostics);
    if (entries.length > MAX_DIAGNOSTIC_KEYS) {
      throw new Error(`\`diagnostics\` must have ${MAX_DIAGNOSTIC_KEYS} keys or fewer`);
    }
    for (const [key, value] of entries) {
      if (typeof value !== "string") {
        throw new Error("`diagnostics` values must all be strings");
      }
      if (value.length > MAX_DIAGNOSTIC_VALUE_LENGTH) {
        throw new Error(
          `\`diagnostics.${key}\` must be ${MAX_DIAGNOSTIC_VALUE_LENGTH} characters or fewer`,
        );
      }
    }
  }

  return {
    title: title.trim(),
    body: body.trim(),
    ...(diagnostics !== undefined ? { diagnostics: diagnostics as Record<string, string> } : {}),
  };
}

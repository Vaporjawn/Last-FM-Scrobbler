import { neutralizeNotifications } from "./neutralize-notifications.js";

/**
 * Neutralizes characters that would let a diagnostics key/value break out of its
 * intended Markdown/HTML containment once interpolated into the issue body:
 * - `<`/`>` escaped to their HTML entities (done in `neutralizeNotifications`), so a value/key can never open or close a
 *   real HTML tag — most importantly `</details>`, which would prematurely close the
 *   collapsible diagnostics section and leave the trailing anonymity disclaimer
 *   (the one piece of text whose entire purpose is to be immediately visible)
 *   collapsed inside a must-expand section instead.
 * - Runs of 3+ backticks broken up with an interspersed zero-width space (invisible
 *   to a reader, but no longer a valid fence delimiter) — a value is wrapped in a
 *   ``` fence below, and per CommonMark a closing fence just needs to be a same-
 *   or-longer backtick run alone on its own line; diagnostics values here can be
 *   genuinely multi-line (e.g. `recentLogs`), so a crafted value containing its own
 *   ``` on a line by itself would otherwise close the fence early and let everything
 *   after it be interpreted as real Markdown/HTML instead of literal preformatted
 *   text.
 */
export function neutralizeForIssueBody(text: string): string {
  return neutralizeNotifications(text).replace(/`{3,}/g, (run) => run.split("").join("​"));
}

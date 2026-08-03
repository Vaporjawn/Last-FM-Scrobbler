import type { BugReportRequest } from "./bug-report-request.js";

/**
 * Neutralizes characters that would let a diagnostics key/value break out of its
 * intended Markdown/HTML containment once interpolated into the issue body:
 * - `<`/`>` escaped to their HTML entities, so a value/key can never open or close a
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
function neutralizeForIssueBody(text: string): string {
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`{3,}/g, (run) => run.split("").join("​"));
}

/**
 * Renders the GitHub issue body: the reporter's own text, followed by a collapsed
 * diagnostics section (if any were attached) so the issue stays readable by default.
 * Ends with a fixed disclaimer, since these issues have no linked GitHub account —
 * anyone reading the issue should immediately understand why "Reporter" isn't a person.
 */
export function formatIssueBody(report: BugReportRequest): string {
  const sections = [report.body];

  if (report.diagnostics && Object.keys(report.diagnostics).length > 0) {
    const lines = Object.entries(report.diagnostics).map(
      ([key, value]) =>
        `**${neutralizeForIssueBody(key)}**\n\n\`\`\`\n${neutralizeForIssueBody(value)}\n\`\`\``,
    );
    sections.push(
      `<details>\n<summary>Diagnostics</summary>\n\n${lines.join("\n\n")}\n\n</details>`,
    );
  }

  sections.push(
    "---\n_Filed anonymously via the in-app bug reporter — no GitHub account is linked to this report._",
  );

  return sections.join("\n\n");
}

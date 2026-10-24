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
  return neutralizeNotifications(text)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`{3,}/g, (run) => run.split("").join("​"));
}

/**
 * Stops anonymous text from notifying or cross-linking anyone on GitHub. This relay files
 * issues with a real account's token and accepts reports from anybody, so a body saying
 * `@some-user` or `@org/team` would send them a notification, and `#123` (or
 * `owner/repo#123`) would add a "mentioned this" entry to an unrelated issue — free
 * spam/harassment channels. A zero-width space after the `@` or `#` keeps the text
 * readable but no longer parses as a mention or reference. An `@` that follows a word
 * character (`name@example.com`) is an email address, not a mention, and is left alone.
 */
function neutralizeNotifications(text: string): string {
  return text
    .replace(/(?<![A-Za-z0-9])@(?=[A-Za-z0-9_-])/g, "@\u200B")
    .replace(/#(?=\d)/g, "#\u200B");
}

/**
 * Renders the GitHub issue body: the reporter's own text, followed by a collapsed
 * diagnostics section (if any were attached) so the issue stays readable by default.
 * Ends with a fixed disclaimer, since these issues have no linked GitHub account —
 * anyone reading the issue should immediately understand why "Reporter" isn't a person.
 */
export function formatIssueBody(report: BugReportRequest): string {
  const sections = [neutralizeNotifications(report.body)];

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

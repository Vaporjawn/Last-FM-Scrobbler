import type { BugReportRequest } from "./bug-report-request.js";

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
function neutralizeForIssueBody(text: string): string {
  return neutralizeNotifications(text).replace(/`{3,}/g, (run) => run.split("").join("​"));
}

/**
 * Stops anonymous text from notifying or cross-linking anyone on GitHub. This relay files
 * issues with a real account's token and accepts reports from anybody, so a body saying
 * `@some-user` or `@org/team` would send them a notification, and `#123`, `GH-123`,
 * `owner/repo#123` or a github.com issue URL would add a "mentioned this" entry to an
 * unrelated issue — free spam/harassment channels.
 *
 * `&`, `<` and `>` are escaped FIRST. Otherwise an HTML entity (`&#64;user`) or inline tag
 * would survive the steps below as plain characters and be decoded back into a live `@` or
 * `#` by the Markdown renderer, which is a parser differential: the sanitizer and the
 * renderer would disagree about what the text says. After escaping, every `&` is `&amp;`,
 * so no entity can be formed.
 *
 * A zero-width space after the `@`, `#` or `GH-`, and inside `github.com` host keeps the text readable but
 * no longer parses as a mention or reference. An `@` that follows a word character
 * (`name@example.com`) is an email address, not a mention, and is left alone.
 */
function neutralizeNotifications(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(?<![A-Za-z0-9])@(?=[A-Za-z0-9_-])/g, "@\u200B")
    .replace(/#(?=\d)/g, "#\u200B")
    .replace(/(?<![A-Za-z0-9])GH-(?=\d)/gi, (prefix) => `${prefix}\u200B`)
    .replace(/github\.com/gi, (host) => `github\u200B${host.slice("github".length)}`);
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

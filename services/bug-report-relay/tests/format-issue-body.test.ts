import { describe, expect, it } from "vitest";
import { formatIssueBody } from "../src/format-issue-body.js";
import type { BugReportRequest } from "../src/bug-report-request.js";

describe("formatIssueBody", () => {
  it("includes the reporter's body text and the anonymity disclaimer", () => {
    const body = formatIssueBody({ title: "Crash on launch", body: "It crashes every time." });

    expect(body).toContain("It crashes every time.");
    expect(body).toContain("Filed anonymously via the in-app bug reporter");
  });

  it("omits the diagnostics section entirely when none are attached", () => {
    const body = formatIssueBody({ title: "x", body: "y" });

    expect(body).not.toContain("<details>");
  });

  it("renders each diagnostics entry inside a collapsed <details> section", () => {
    const report: BugReportRequest = {
      title: "x",
      body: "y",
      diagnostics: { platform: "darwin", appVersion: "1.2.3" },
    };

    const body = formatIssueBody(report);

    expect(body).toContain("<details>");
    expect(body).toContain("**platform**");
    expect(body).toContain("```\ndarwin\n```");
    expect(body).toContain("**appVersion**");
    expect(body).toContain("```\n1.2.3\n```");
  });

  it("does not let a diagnostics value close its code fence early and inject fake markdown", () => {
    // Regression test: a diagnostics value containing its own ``` (alone on a line,
    // which is a real, plausible shape for a multi-line value like recentLogs) used
    // to close the surrounding fence early — everything after it in that value would
    // then be interpreted as real Markdown/HTML instead of literal preformatted text,
    // letting a crafted value inject a fake section into the issue.
    const maliciousValue =
      "before\n```\n\n## Fake Section\n\nThis looks like a real part of the issue.\n\n```\nafter";
    const report: BugReportRequest = { title: "x", body: "y", diagnostics: { log: maliciousValue } };

    const body = formatIssueBody(report);

    // Exactly one real fence pair (the template's own open + close) survives as
    // standalone ``` lines — the value's embedded ``` runs must not create any
    // *additional* ones that could act as fence delimiters.
    const standaloneFenceLines = body.match(/^```$/gm) ?? [];
    expect(standaloneFenceLines).toHaveLength(2);
    // The literal text is preserved (not deleted) — just safely contained as literal
    // preformatted content instead of being interpreted as a real Markdown heading.
    expect(body).toContain("Fake Section");
  });

  it("does not let a diagnostics value hide the trailing disclaimer inside an unclosed <details>", () => {
    // Regression test: a value containing an unclosed <details> tag used to exploit
    // GitHub's raw-HTML allowlist — the unclosed tag swallowed everything up to and
    // including the template's own closing </details>, collapsing the anonymity
    // disclaimer (which comes after it) into a hidden, must-expand section.
    const report: BugReportRequest = {
      title: "x",
      body: "y",
      diagnostics: { note: "<details><summary>debug</summary>" },
    };

    const body = formatIssueBody(report);

    // The injected tag is neutralized (escaped), not a real HTML tag.
    expect(body).not.toContain("<details><summary>debug</summary>");
    expect(body).toContain("&lt;details&gt;&lt;summary&gt;debug&lt;/summary&gt;");
    // The disclaimer must still be plainly visible — after the template's own real,
    // unescaped closing </details> tag — not trapped inside a nested collapsed
    // structure.
    const closingDetailsIndex = body.lastIndexOf("</details>");
    const disclaimerIndex = body.indexOf("Filed anonymously");
    expect(closingDetailsIndex).toBeGreaterThan(-1);
    expect(disclaimerIndex).toBeGreaterThan(closingDetailsIndex);
  });

  it("neutralizes an HTML/markdown-distorting diagnostics key the same way as a value", () => {
    // Regression test: only values were validated/neutralized — a crafted key could
    // distort the `**${key}**` heading line the same way a value could distort the
    // fenced block, e.g. injecting a fake heading or breaking out via an HTML tag.
    const report: BugReportRequest = {
      title: "x",
      body: "y",
      diagnostics: { "</details><h1>pwned</h1>": "value" },
    };

    const body = formatIssueBody(report);

    expect(body).not.toContain("<h1>pwned</h1>");
    expect(body).toContain("&lt;/details&gt;&lt;h1&gt;pwned&lt;/h1&gt;");
  });
});

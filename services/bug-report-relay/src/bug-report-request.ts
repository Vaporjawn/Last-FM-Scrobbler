/**
 * The validated body of an anonymous bug report, as produced by `parseBugReportRequest`
 * from the client's JSON and consumed by `createGitHubIssue` and `formatIssueBody`.
 * `diagnostics` maps a label to free-form text (for example recent logs), and is
 * rendered in a collapsed section of the issue.
 */
export interface BugReportRequest {
  readonly title: string;
  readonly body: string;
  readonly diagnostics?: Record<string, string>;
}

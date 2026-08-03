export interface BugReportRequest {
  readonly title: string;
  readonly body: string;
  readonly diagnostics?: Record<string, string>;
}

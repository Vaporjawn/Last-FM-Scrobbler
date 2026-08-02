/**
 * The renderer-facing bug-report API the preload script exposes via
 * `contextBridge.exposeInMainWorld("bugReport", ...)`. See
 * `main/bug-report/wire-bug-report.ts` and docs/adr/0004-anonymous-bug-report-relay.md
 * — reports are relayed to `services/bug-report-relay`, which files them as a GitHub
 * issue with no reporter GitHub account required.
 */
export interface BugReportApi {
  /** Whether this build has a relay URL configured at all. */
  isConfigured(): Promise<boolean>;
  /** Submits a report; resolves with the URL of the created GitHub issue. */
  submit(title: string, body: string): Promise<{ issueUrl: string }>;
}

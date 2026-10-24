import electron from "electron";
import type { Logger } from "@lastfm-scrobbler/core";
import { wireBugReport } from "../bug-report/wire-bug-report.js";

const { app } = electron;

/**
 * Wires the in-app bug report IPC, supplying the diagnostics attached to each report: the
 * platform, architecture, app version and the last 50 log lines. The relay URL comes from
 * the `BUG_REPORT_RELAY_URL` value baked into the build (or the dev `.env`).
 */
export function wireBugReportDiagnostics(expectedOrigin: string, logger: Logger): void {
  wireBugReport({
    expectedOrigin,
    relayUrl: process.env.BUG_REPORT_RELAY_URL,
    getDiagnostics: () => ({
      platform: process.platform,
      arch: process.arch,
      appVersion: app.getVersion(),
      recentLogs: logger.formatRecentEntriesAsText(50),
    }),
  });
}

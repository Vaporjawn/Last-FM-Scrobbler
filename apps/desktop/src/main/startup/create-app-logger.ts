import { Logger } from "@lastfm-scrobbler/core";

/**
 * Creates the app-wide `Logger`: a bounded ring buffer of recent log lines, attached to bug
 * reports as diagnostics (see `wireBugReportDiagnostics`) and echoed to the console. It never
 * logs credentials (session keys, API secrets), only operational messages like "adapter
 * construction failed" or "relay returned 502".
 */
export function createAppLogger(): Logger {
  return new Logger({
    level: "basic",
    sink: (entry) => {
      console.log(entry.message);
    },
  });
}

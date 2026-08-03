import electron from "electron";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";
import { assertTrustedSender } from "../validate-ipc-sender.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

const NOT_CONFIGURED_MESSAGE =
  "Bug reporting is not configured for this build (BUG_REPORT_RELAY_URL) — see " +
  "docs/modules/desktop.md.";

export interface WireBugReportOptions {
  /** Checked on `bugReportSubmit` specifically (not `bugReportIsConfigured`, a plain
   * read with no side effect) — see `validate-ipc-sender.ts`. Unlike the other
   * unguarded read-only handlers in this app, submitting a bug report has a real
   * external side effect (files a genuine GitHub issue via the relay), making it the
   * one worth the same defense-in-depth every other side-effecting handler already
   * has. */
  readonly expectedOrigin: string;
  /** `undefined` (or `""` — see `main/index.ts`'s `BUG_REPORT_RELAY_URL` env var and
   * `electron.vite.config.ts`'s build-time `define`, which bakes in `""` rather than
   * omitting the property entirely when this build has no relay URL configured) when
   * this build has no relay URL configured. */
  readonly relayUrl: string | undefined;
  /** Attached to every report as `diagnostics` — e.g. platform, app version, recent
   * log lines. Never call anything here that could include a Last.fm session key or
   * other credential (see docs/adr/0004-anonymous-bug-report-relay.md). */
  readonly getDiagnostics?: () => Record<string, string>;
  /** Injectable for testing; defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch;
}

interface RelayResponse {
  readonly issueUrl: string;
  readonly issueNumber: number;
}

/**
 * Wires the bug-report IPC surface (see `shared/bug-report-api.ts`) to
 * `services/bug-report-relay`. The relay itself handles anonymous GitHub issue
 * creation — this just forwards the report and diagnostics to it.
 */
export function wireBugReport(options: WireBugReportOptions): () => void {
  const { expectedOrigin, relayUrl, getDiagnostics } = options;
  const fetchImpl = options.fetchImpl ?? fetch;

  // `Boolean(relayUrl)` rather than `relayUrl !== undefined`: a build-time `define` can
  // bake in `""` instead of an absent/undefined value (see this option's docstring), and
  // an empty string is exactly as "not configured" as a missing one.
  ipcMain.handle(IPC_CHANNELS.bugReportIsConfigured, (): boolean => Boolean(relayUrl));

  ipcMain.handle(
    IPC_CHANNELS.bugReportSubmit,
    async (event, title: unknown, body: unknown): Promise<RelayResponse> => {
      assertTrustedSender(event, expectedOrigin);
      if (!relayUrl) {
        throw new Error(NOT_CONFIGURED_MESSAGE);
      }

      const response = await fetchImpl(relayUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: String(title),
          body: String(body),
          ...(getDiagnostics ? { diagnostics: getDiagnostics() } : {}),
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Bug report relay returned ${response.status}: ${detail}`);
      }

      return (await response.json()) as RelayResponse;
    },
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.bugReportIsConfigured);
    ipcMain.removeHandler(IPC_CHANNELS.bugReportSubmit);
  };
}

import { useCallback, useEffect, useState } from "react";

export interface UseBugReportResult {
  /** `undefined` while still checking, then whether this build can actually submit reports. */
  readonly isConfigured: boolean | undefined;
  readonly submitting: boolean;
  readonly error: string | undefined;
  readonly issueUrl: string | undefined;
  readonly submit: (title: string, body: string) => Promise<void>;
  /** Clears `error`/`issueUrl` — call when the report dialog is reopened. */
  readonly reset: () => void;
}

/**
 * Submits bug reports via `window.bugReport` (see `src/shared/bug-report-api.ts`).
 * Returns inert defaults — never throws — when `window.bugReport` isn't present, which
 * is expected outside a real Electron renderer (e.g. component tests).
 */
export function useBugReport(): UseBugReportResult {
  const [isConfigured, setIsConfigured] = useState<boolean | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [issueUrl, setIssueUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!window.bugReport) {
      // No API to check — resolve the "loading" state to `false` rather than leaving
      // `isConfigured` at its initial `undefined` forever, which the dialog reads as
      // "still checking" and shows an indefinite spinner for. This matters beyond
      // component tests: if the preload script ever fails to load in a real build
      // (see docs/modules/desktop.md's sandboxed-preload gotcha), every `window.*` API
      // is silently missing exactly like this, and the UI should degrade to a visible
      // "not configured" state instead of hanging with no explanation.
      setIsConfigured(false);
      return;
    }
    window.bugReport
      .isConfigured()
      .then(setIsConfigured)
      .catch(() => {
        setIsConfigured(false);
      });
  }, []);

  const submit = useCallback(async (title: string, body: string) => {
    if (!window.bugReport) {
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const result = await window.bugReport.submit(title, body);
      setIssueUrl(result.issueUrl);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSubmitting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(undefined);
    setIssueUrl(undefined);
  }, []);

  return { isConfigured, submitting, error, issueUrl, submit, reset };
}

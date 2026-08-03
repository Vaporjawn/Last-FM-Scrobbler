import type { BugReportRequest } from "./bug-report-request.js";
import { formatIssueBody } from "./format-issue-body.js";
import { GitHubIssueCreationError } from "./github-issue-creation-error.js";

const GITHUB_REPO = "Vaporjawn/Last-FM-Scrobbler";
const GITHUB_API_VERSION = "2026-03-10";
const USER_AGENT = "lastfm-scrobbler-bug-report-relay";

interface GitHubCreateIssueResponse {
  readonly html_url: string;
  readonly number: number;
}

/**
 * Creates a GitHub issue for `report` via the REST API, authenticated with the relay's
 * classic, `public_repo`-scoped PAT (see `Env.GITHUB_PAT`'s docstring). Throws
 * `GitHubIssueCreationError` on any non-2xx response — the caller is responsible for
 * not leaking `error.message` (which may echo GitHub's own error detail) back to an
 * anonymous, unauthenticated caller.
 */
export async function createGitHubIssue(
  report: BugReportRequest,
  githubPat: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubCreateIssueResponse> {
  const response = await fetchImpl(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubPat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": USER_AGENT,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: `[BUG]: ${report.title}`,
      body: formatIssueBody(report),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GitHubIssueCreationError(
      response.status,
      `GitHub API returned ${response.status}: ${detail}`,
    );
  }

  // `response.json<T>()` is only a compile-time type assertion (Cloudflare Workers'
  // typed-fetch generic) — nothing about it validates at runtime that GitHub's 2xx
  // response actually has these two fields. Without this check, an API-shape drift or
  // unexpected intermediary response would silently produce `{ html_url: undefined,
  // number: undefined }`, which the caller (`index.ts`) would then report back to the
  // user as `201 { issueUrl: undefined, issueNumber: undefined }` — a reported
  // success that actually lost the real result.
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { html_url?: unknown }).html_url !== "string" ||
    typeof (body as { number?: unknown }).number !== "number"
  ) {
    throw new GitHubIssueCreationError(
      response.status,
      "GitHub API returned a 2xx response with an unexpected shape (missing html_url/number)",
    );
  }
  return body as GitHubCreateIssueResponse;
}

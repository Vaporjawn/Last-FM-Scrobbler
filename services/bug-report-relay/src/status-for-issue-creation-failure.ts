import { GitHubIssueCreationError } from "./github-issue-creation-error.js";

/**
 * Chooses the HTTP status to report back to the caller for a failed `createGitHubIssue`
 * call. GitHub's own `5xx` and `429` responses are transient — those keep the existing
 * `502` ("try again later"). Any other `4xx` from GitHub (bad/expired `GITHUB_PAT`,
 * wrong repo, insufficient scope, etc.) is instead a maintainer-side misconfiguration
 * that retrying will never fix, so it's reported as `500` — distinct from the `503`
 * used above for "GITHUB_PAT not configured at all" — to signal "this relay is broken,
 * not you" rather than "try again shortly". Anything that isn't a
 * `GitHubIssueCreationError` (e.g. GitHub returned a 2xx with an unexpected shape)
 * falls back to the existing `502`.
 */
export function statusForIssueCreationFailure(error: unknown): number {
  if (!(error instanceof GitHubIssueCreationError)) {
    return 502;
  }
  const isPermanentClientError = error.status >= 400 && error.status < 500 && error.status !== 429;
  return isPermanentClientError ? 500 : 502;
}

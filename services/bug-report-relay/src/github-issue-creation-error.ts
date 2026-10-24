/** Thrown by `createGitHubIssue` on any non-2xx response from the GitHub REST API —
 * `status` lets `index.ts`'s `fetch` handler distinguish a transient 5xx/429 (reported
 * to the caller as a 502, "try again later") from a permanent 4xx (a maintainer-side
 * misconfiguration, reported as a 500), without ever leaking `message` — which may
 * echo GitHub's own error detail — to an anonymous, unauthenticated caller. */
export class GitHubIssueCreationError extends Error {
  /**
   * Records the HTTP status alongside the diagnostic message so callers can branch on it.
   *
   * @param status The HTTP status GitHub answered with (the 2xx status for a malformed
   * success body).
   * @param message Diagnostic text for server-side logs; never relay it to the caller.
   */
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GitHubIssueCreationError";
  }
}

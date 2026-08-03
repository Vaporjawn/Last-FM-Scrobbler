/** Thrown by `createGitHubIssue` on any non-2xx response from the GitHub REST API —
 * `status` lets a caller distinguish e.g. a transient 5xx from a permanent 4xx, though
 * `index.ts`'s `fetch` handler currently treats every case the same (a flat 502, never
 * leaking `message` — which may echo GitHub's own error detail — to an anonymous,
 * unauthenticated caller). */
export class GitHubIssueCreationError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GitHubIssueCreationError";
  }
}

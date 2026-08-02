const GITHUB_REPO = "Vaporjawn/Last-FM-Scrobbler";
const GITHUB_API_VERSION = "2026-03-10";
const USER_AGENT = "lastfm-scrobbler-bug-report-relay";

/** Requests from the same IP within this window beyond `RATE_LIMIT_MAX_REQUESTS` are rejected. */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

export interface BugReportRequest {
  readonly title: string;
  readonly body: string;
  readonly diagnostics?: Record<string, string>;
}

export interface Env {
  /** Fine-grained PAT scoped to `issues:write` on this one repo — see
   * docs/adr/0004-anonymous-bug-report-relay.md. Set via `wrangler secret put GITHUB_PAT`,
   * never committed and never shipped inside the distributed desktop app. */
  readonly GITHUB_PAT: string;
}

export function parseBugReportRequest(payload: unknown): BugReportRequest {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Request body must be a JSON object");
  }

  const { title, body, diagnostics } = payload as Record<string, unknown>;

  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("`title` is required and must be a non-empty string");
  }

  if (typeof body !== "string" || body.trim().length === 0) {
    throw new Error("`body` is required and must be a non-empty string");
  }

  if (diagnostics !== undefined) {
    if (typeof diagnostics !== "object" || diagnostics === null) {
      throw new Error("`diagnostics` must be an object of string values when present");
    }
    for (const value of Object.values(diagnostics)) {
      if (typeof value !== "string") {
        throw new Error("`diagnostics` values must all be strings");
      }
    }
  }

  return {
    title: title.trim(),
    body: body.trim(),
    ...(diagnostics !== undefined ? { diagnostics: diagnostics as Record<string, string> } : {}),
  };
}

/**
 * Renders the GitHub issue body: the reporter's own text, followed by a collapsed
 * diagnostics section (if any were attached) so the issue stays readable by default.
 * Ends with a fixed disclaimer, since these issues have no linked GitHub account —
 * anyone reading the issue should immediately understand why "Reporter" isn't a person.
 */
export function formatIssueBody(report: BugReportRequest): string {
  const sections = [report.body];

  if (report.diagnostics && Object.keys(report.diagnostics).length > 0) {
    const lines = Object.entries(report.diagnostics).map(
      ([key, value]) => `**${key}**\n\n\`\`\`\n${value}\n\`\`\``,
    );
    sections.push(
      `<details>\n<summary>Diagnostics</summary>\n\n${lines.join("\n\n")}\n\n</details>`,
    );
  }

  sections.push(
    "---\n_Filed anonymously via the in-app bug reporter — no GitHub account is linked to this report._",
  );

  return sections.join("\n\n");
}

interface GitHubCreateIssueResponse {
  readonly html_url: string;
  readonly number: number;
}

export class GitHubIssueCreationError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GitHubIssueCreationError";
  }
}

/**
 * Creates a GitHub issue for `report` via the REST API, authenticated with the relay's
 * repo-scoped fine-grained PAT. Throws `GitHubIssueCreationError` on any non-2xx
 * response — the caller is responsible for not leaking `error.message` (which may echo
 * GitHub's own error detail) back to an anonymous, unauthenticated caller.
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

  return await response.json<GitHubCreateIssueResponse>();
}

/**
 * Best-effort per-IP rate limit, backed by an in-memory `Map` scoped to this Worker
 * isolate. This is deliberately not a strong guarantee: Cloudflare may route requests
 * from the same IP to different isolates/edge locations, and an idle isolate can be
 * evicted at any time, resetting its counters. It still meaningfully raises the cost of
 * casual abuse from a single source at effectively zero operational complexity (no KV/
 * Durable Object namespace to provision). A stronger, globally-consistent limit (e.g. a
 * Durable Object per IP, or Cloudflare's Rate Limiting bindings) is a reasonable future
 * upgrade — see docs/modules/bug-report-relay.md.
 */
const requestLog = new Map<string, number[]>();

function isRateLimited(clientIp: string, now: number): boolean {
  const timestamps = (requestLog.get(clientIp) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(clientIp, timestamps);
    return true;
  }

  timestamps.push(now);
  requestLog.set(clientIp, timestamps);
  return false;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
    if (isRateLimited(clientIp, Date.now())) {
      return jsonResponse(
        { error: "Too many bug reports from this address recently — please try again later." },
        429,
      );
    }

    let parsed: BugReportRequest;
    try {
      parsed = parseBugReportRequest(await request.json());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid request body";
      return jsonResponse({ error: message }, 400);
    }

    if (!env.GITHUB_PAT) {
      console.error("bug-report-relay: GITHUB_PAT is not configured");
      return jsonResponse(
        { error: "This relay is not fully configured yet — please try again later." },
        503,
      );
    }

    try {
      const issue = await createGitHubIssue(parsed, env.GITHUB_PAT);
      return jsonResponse({ issueUrl: issue.html_url, issueNumber: issue.number }, 201);
    } catch (error) {
      console.error("bug-report-relay: failed to create GitHub issue:", error);
      return jsonResponse(
        { error: "Could not file this report right now — please try again later." },
        502,
      );
    }
  },
};

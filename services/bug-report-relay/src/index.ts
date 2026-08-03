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
  /** Classic PAT with the `public_repo` scope (this repo's own explicit choice — see
   * docs/adr/0004-anonymous-bug-report-relay.md; a fine-grained PAT scoped to just this
   * repo's `issues:write` would be narrower, but classic is what's actually in use).
   * `public_repo` itself already covers every public repo the token's owner can access,
   * not just this one — narrower than full `repo` scope (which also reaches private
   * repos), but broader than a repo-scoped fine-grained PAT would be. Set via
   * `wrangler secret put GITHUB_PAT`, never committed and never shipped inside the
   * distributed desktop app. */
  readonly GITHUB_PAT: string;
}

/** GitHub's own real API limit for an issue title (verified against their validation
 * error: "title is too long (maximum is 256 characters)") — matching it exactly means
 * no genuinely valid report is ever rejected here that GitHub would have accepted. */
const MAX_TITLE_LENGTH = 256;
/** Comfortably under GitHub's own real issue-body limit (65536 characters) rather than
 * matching it exactly — `formatIssueBody` appends a diagnostics section and a fixed
 * disclaimer to `body`, so the *final* posted body is always somewhat longer than this
 * value; the gap is headroom for that, not slack for oversized reports. */
const MAX_BODY_LENGTH = 60_000;
/** Per-value cap for `diagnostics` — generous for real diagnostics (e.g. the desktop
 * app's own `recentLogs`, a bounded 50-line ring buffer, comes nowhere close), but
 * still a real bound rather than none at all. */
const MAX_DIAGNOSTIC_VALUE_LENGTH = 10_000;
/** Bounds the "many small values" variant of the same problem a single long value
 * would otherwise be the only thing capped against. */
const MAX_DIAGNOSTIC_KEYS = 20;

/**
 * This relay is reachable by anyone on the internet with no authentication at all, by
 * design (see docs/adr/0004-anonymous-bug-report-relay.md) — the length checks below
 * exist for that reason specifically. Without them, a caller (not necessarily the
 * well-behaved Electron client, which always sends bounded diagnostics — anyone who
 * can reach this URL directly) could send an arbitrarily large `title`/`body`/
 * `diagnostics` value; this Worker would fully buffer and forward all of it to
 * GitHub's Issues API before GitHub's own server-side limits eventually rejected it,
 * paying the full cost (Worker CPU time, egress bandwidth, a wasted call against the
 * shared GitHub PAT) of processing a request that was always going to fail. Rejecting
 * oversized input immediately, before any of that work happens, closes that off.
 */
export function parseBugReportRequest(payload: unknown): BugReportRequest {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Request body must be a JSON object");
  }

  const { title, body, diagnostics } = payload as Record<string, unknown>;

  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("`title` is required and must be a non-empty string");
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new Error(`\`title\` must be ${MAX_TITLE_LENGTH} characters or fewer`);
  }

  if (typeof body !== "string" || body.trim().length === 0) {
    throw new Error("`body` is required and must be a non-empty string");
  }
  if (body.length > MAX_BODY_LENGTH) {
    throw new Error(`\`body\` must be ${MAX_BODY_LENGTH} characters or fewer`);
  }

  if (diagnostics !== undefined) {
    if (typeof diagnostics !== "object" || diagnostics === null) {
      throw new Error("`diagnostics` must be an object of string values when present");
    }
    const entries = Object.entries(diagnostics);
    if (entries.length > MAX_DIAGNOSTIC_KEYS) {
      throw new Error(`\`diagnostics\` must have ${MAX_DIAGNOSTIC_KEYS} keys or fewer`);
    }
    for (const [key, value] of entries) {
      if (typeof value !== "string") {
        throw new Error("`diagnostics` values must all be strings");
      }
      if (value.length > MAX_DIAGNOSTIC_VALUE_LENGTH) {
        throw new Error(
          `\`diagnostics.${key}\` must be ${MAX_DIAGNOSTIC_VALUE_LENGTH} characters or fewer`,
        );
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

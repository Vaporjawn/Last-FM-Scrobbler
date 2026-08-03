import type { BugReportRequest } from "./bug-report-request.js";
import { createGitHubIssue } from "./create-github-issue.js";
import type { Env } from "./env.js";
import { parseBugReportRequest } from "./parse-bug-report-request.js";

/** Requests from the same IP within this window beyond `RATE_LIMIT_MAX_REQUESTS` are rejected. */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

/**
 * Best-effort per-IP rate limit, backed by an in-memory `Map` scoped to this Worker
 * isolate. This is deliberately not a strong guarantee: Cloudflare may route requests
 * from the same IP to different isolates/edge locations, and an idle isolate can be
 * evicted at any time, resetting its counters. It still meaningfully raises the cost of
 * casual abuse from a single source at effectively zero operational complexity (no KV/
 * Durable Object namespace to provision). A stronger, globally-consistent limit (e.g. a
 * Durable Object per IP, or Cloudflare's Rate Limiting bindings) is a reasonable future
 * upgrade — see docs/modules/bug-report-relay.md. Private to this module: it's tightly
 * coupled to `requestLog`'s isolate-scoped state and has no meaning outside handling a
 * request for this specific Worker.
 */
const requestLog = new Map<string, number[]>();

/** How often (in number of `isRateLimited` calls) to run the full sweep below — not
 * every call, to keep the common case cheap. */
const SWEEP_INTERVAL = 100;
let callsSinceSweep = 0;

function isRateLimited(clientIp: string, now: number): boolean {
  const timestamps = (requestLog.get(clientIp) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  let limited: boolean;
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(clientIp, timestamps);
    limited = true;
  } else {
    timestamps.push(now);
    requestLog.set(clientIp, timestamps);
    limited = false;
  }

  sweepStaleEntries(now);
  return limited;
}

/**
 * Sweeps every IP's own entry for timestamps that have aged out of the rate-limit
 * window, deleting any entry that ends up empty. `isRateLimited` above only ever
 * prunes *the current caller's own* entry — an IP that stops sending requests
 * otherwise keeps its (small, but permanent) entry in `requestLog` forever, so a
 * long-lived warm isolate under sustained traffic from many thousands of distinct
 * IPs would grow the map without bound. Runs only every `SWEEP_INTERVAL` calls
 * (not on every request) since a full-map scan is real work not worth paying for
 * on the common, already-handled path.
 */
function sweepStaleEntries(now: number): void {
  callsSinceSweep += 1;
  if (callsSinceSweep < SWEEP_INTERVAL) {
    return;
  }
  callsSinceSweep = 0;

  for (const [ip, timestamps] of requestLog) {
    const fresh = timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) {
      requestLog.delete(ip);
    } else if (fresh.length !== timestamps.length) {
      requestLog.set(ip, fresh);
    }
  }
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

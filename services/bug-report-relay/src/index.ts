import type { BugReportRequest } from "./bug-report-request.js";
import { createGitHubIssue } from "./create-github-issue.js";
import type { Env } from "./env.js";
import { isRateLimited } from "./is-rate-limited.js";
import { jsonResponse } from "./json-response.js";
import { parseBugReportRequest } from "./parse-bug-report-request.js";
import { readBodyWithinLimit } from "./read-body-within-limit.js";
import { statusForIssueCreationFailure } from "./status-for-issue-creation-failure.js";

/**
 * The Cloudflare Worker entry point. Accepts a `POST` bug report from the desktop app,
 * rate limits it per address, bounds and validates the body, and files it as a GitHub
 * issue with the relay's own token, so the app never ships a credential that can write
 * to the repository. See docs/modules/bug-report-relay.md.
 */
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

    const rawBody = await readBodyWithinLimit(request);
    if (rawBody === undefined) {
      return jsonResponse({ error: "Request body is too large." }, 413);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON" }, 400);
    }

    let parsed: BugReportRequest;
    try {
      parsed = parseBugReportRequest(payload);
    } catch (error) {
      // `parseBugReportRequest` rejects only by throwing `Error`s with a message meant
      // for the caller.
      return jsonResponse({ error: (error as Error).message }, 400);
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
        statusForIssueCreationFailure(error),
      );
    }
  },
};

# `services/bug-report-relay`

## Responsibility

Cloudflare Worker. Receives a bug report from `apps/desktop`, validates it, and creates
a GitHub issue via a relay-side, repo-scoped `issues:write` fine-grained PAT — so a
reporter never needs a GitHub account and the credential never ships inside the
distributed app. See ADR 0004.

## Setup: the `GITHUB_PAT` secret

1. Create a fine-grained PAT at https://github.com/settings/personal-access-tokens/new,
   scoped **only** to the `Vaporjawn/Last-FM-Scrobbler` repository, with **Issues:
   write** repository permission (no other permissions needed).
2. `wrangler secret put GITHUB_PAT` from this directory, and paste the token when
   prompted. Never commit it, never put it in `wrangler.toml`, never log it.

Without this secret configured, the relay still starts and validates requests
correctly, but responds `503` to well-formed reports rather than crashing or silently
dropping them.

## Public interface

- `parseBugReportRequest(payload: unknown): BugReportRequest` — validates
  `{title, body, diagnostics?}`, throws with a descriptive message on invalid input.
- `formatIssueBody(report: BugReportRequest): string` — the reporter's text, an
  optional collapsed `<details>` diagnostics section, and a fixed disclaimer noting the
  report has no linked GitHub account.
- `createGitHubIssue(report, githubPat, fetchImpl?)` — calls
  `POST /repos/Vaporjawn/Last-FM-Scrobbler/issues`, prefixing the issue title with
  `[BUG]: ` per this project's title convention (see `docs/CONTRIBUTING.md`). Throws
  `GitHubIssueCreationError` on any non-2xx response.
- `fetch(request, env)` (default export):
  - `405` for non-POST requests.
  - `429` if the same `cf-connecting-ip` has made 5+ requests in the last 10 minutes
    (see "Rate limiting" below).
  - `400` for invalid request bodies.
  - `503` if `GITHUB_PAT` isn't configured for this deployment.
  - `502` if GitHub's API call fails (the specific GitHub error detail is logged
    server-side via `console.error`, not returned to the caller — an anonymous,
    unauthenticated endpoint shouldn't echo internal error detail).
  - `201` with `{issueUrl, issueNumber}` on success.

## Rate limiting

A best-effort per-IP limit (5 requests / 10 minutes), backed by a plain in-memory `Map`
scoped to the Worker's module — deliberately not a strong guarantee. Cloudflare may
route requests from the same IP to different isolates or edge locations, and an idle
isolate can be evicted at any time, resetting its counters. It still meaningfully
raises the cost of casual single-source abuse at zero operational complexity (no KV or
Durable Object namespace to provision). A globally-consistent limit (a Durable Object
per IP, or Cloudflare's Rate Limiting bindings) is a reasonable future upgrade if abuse
becomes a real problem — see ADR 0004.

## Not yet built

- Issue de-duplication (search before create) — a reasonable future enhancement, not
  required for v1 per ADR 0004.
- A globally-consistent rate limit (see above).
- CAPTCHA (e.g. Cloudflare Turnstile) if the best-effort rate limit proves insufficient
  against real abuse.

## Dependencies

`wrangler`, `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`. No runtime
dependencies beyond the Workers platform itself (`fetch` to GitHub's REST API).

## Status

Fully implemented and tested against a real Cloudflare Workers runtime (via
`@cloudflare/vitest-pool-workers`'s `workerd`-backed test pool — not a Node.js mock of
the platform): 13 tests covering request validation, real issue creation (with the
outbound `fetch` to `api.github.com` intercepted — no live GitHub calls made in tests),
diagnostics formatting, error-detail non-leakage, and the rate limiter. `wrangler
deploy --dry-run` confirms the Worker bundles correctly. Not deployed or verified
against the real GitHub API or a real Cloudflare account in this development
environment — no Cloudflare credentials or a real `GITHUB_PAT` were available here.

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

## Deployment

`.github/workflows/deploy-bug-report-relay.yml` deploys this Worker to Cloudflare
automatically — on every push to `main` that touches `services/bug-report-relay/**`,
or manually via that workflow's "Run workflow" button. It needs two repo secrets this
project never bakes in (same reasoning as `LASTFM_API_KEY` — see
docs/modules/desktop.md):

- `CLOUDFLARE_API_TOKEN` — a Workers-scoped API token (see
  https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).
- `CLOUDFLARE_ACCOUNT_ID` — from the Cloudflare dashboard's account overview page.

Without them, the workflow's deploy step fails clearly (missing credentials) rather
than silently no-op'ing. The `GITHUB_PAT` secret above is separate and isn't part of
this workflow — it's set once directly against the Worker via `wrangler secret put
GITHUB_PAT` (from this directory) and persists across redeploys on Cloudflare's side,
so the deploy workflow doesn't need to (and shouldn't) touch it.

Once deployed, `wrangler deploy`'s own output (and the Cloudflare dashboard) shows the
Worker's URL — typically
`https://lastfm-scrobbler-bug-report-relay.<your-subdomain>.workers.dev`. Append
`/report` to that (matching this Worker's single POST route) and set the result as a
`BUG_REPORT_RELAY_URL` repo secret — `.github/workflows/release.yml`'s packaging step
reads it from there and, via `apps/desktop/electron.vite.config.ts`'s build-time
`define`, actually bakes it into the packaged binary (see docs/modules/desktop.md's
"Bug reporting" section for why that extra step is necessary — a real gap, found and
fixed, not just documentation). For local dev, set it in `apps/desktop/.env` instead —
see docs/modules/desktop.md.

For local development, `wrangler dev` reads secrets from a `.dev.vars` file in this
directory (gitignored — never commit one) in the form `GITHUB_PAT=...`; without one,
local `npm run dev` here behaves the same as a deployment with no `GITHUB_PAT`
configured (correctly validates requests, responds `503`).

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
deploy --dry-run` confirms the Worker bundles correctly, and deployment itself is now
automated (see "Deployment" above).

Additionally verified with a real (not vitest-mocked) local run: `wrangler dev` started
this Worker for real against `workerd` — the same runtime `wrangler deploy` uses, via
the same `wrangler.toml` — and real `curl` requests confirmed, live: `405`/`400` for
malformed requests, `503` with no `GITHUB_PAT` bound, a real outbound call to
`https://api.github.com/repos/Vaporjawn/Last-FM-Scrobbler/issues` that 401s against a
placeholder PAT and gets correctly wrapped into a non-leaking `502`, and `429` on the
6th request from one IP within the rate-limit window. This is as far as this feature
can be verified without a real Cloudflare account or a real fine-grained `GITHUB_PAT` —
neither is available in this development environment, and this project never generates
or hardcodes either (same reasoning as `LASTFM_API_KEY`).

Not actually deployed to Cloudflare's edge in this development environment — this
repo's `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/`GITHUB_PAT` secrets haven't been
configured yet, so the deploy workflow above hasn't actually run for real. Until that
happens, `apps/desktop` has no working `BUG_REPORT_RELAY_URL` to point at, and "Report
a Bug" correctly (not a bug) shows "not configured" — see docs/modules/desktop.md.

A separate, real bug *was* found and fixed while verifying this: `apps/desktop`
previously had no mechanism to actually bake a `BUG_REPORT_RELAY_URL` repo secret into
a packaged build at all (setting it during CI packaging did nothing on its own — see
docs/modules/desktop.md's "Bug reporting" section for the full story). That's now
fixed; once this Worker is deployed and `BUG_REPORT_RELAY_URL` is set as a repo secret,
a packaged `apps/desktop` build will actually have it available.

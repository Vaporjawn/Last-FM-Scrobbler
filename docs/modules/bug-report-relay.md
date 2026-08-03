# `services/bug-report-relay`

## Responsibility

Cloudflare Worker. Receives a bug report from `apps/desktop`, validates it, and creates
a GitHub issue via a relay-side, classic `public_repo`-scoped PAT — so a reporter never
needs a GitHub account and the credential never ships inside the distributed app. See
ADR 0004 for why classic (broader, reaches every public repo the token's owner can
access) was chosen over a repo-scoped fine-grained PAT (narrower, this repo only) — a
deliberate choice by this repo's owner, not an oversight.

## Setup: the `GITHUB_PAT` secret

1. Create a classic PAT at https://github.com/settings/tokens/new with the
   `public_repo` scope (write access to code/issues/PRs on public repos — this repo is
   public, so this is the minimal classic scope that covers issue creation; the broader
   `repo` scope, which also reaches private repos, isn't needed).
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
  `{title, body, diagnostics?}`, throws with a descriptive message on invalid input,
  including per-field length limits: `title` ≤ 256 characters (GitHub's own real
  limit — verified against GitHub's actual validation error text, "title is too long
  (maximum is 256 characters)"), `body` ≤ 60,000 characters (comfortably under
  GitHub's real 65,536-character body limit, leaving headroom for the diagnostics
  section and disclaimer `formatIssueBody` appends), each `diagnostics` value ≤
  10,000 characters, and `diagnostics` itself ≤ 20 keys. These exist specifically
  because this endpoint is reachable by anyone with no authentication (see "Rate
  limiting" below) — without them, an oversized payload would be fully buffered and
  forwarded to GitHub's API before GitHub's own limits eventually rejected it, paying
  the full cost (Worker CPU, egress, a wasted call against the shared PAT) of a
  request that was always going to fail.
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

## Module layout (`src/`)

- `bug-report-request.ts` — `BugReportRequest`, the validated shape
  (`{title, body, diagnostics?: Record<string, string>}`) every other file in this
  package works with.
- `env.ts` — `Env`, the Worker's binding shape: just `GITHUB_PAT`, the classic
  `public_repo`-scoped PAT (see "Setup" above and ADR 0004 for why classic over
  fine-grained is this repo owner's deliberate choice).
- `parse-bug-report-request.ts` — see "Public interface" above.
- `format-issue-body.ts` — `formatIssueBody(report): string`, joining the reporter's
  body, an optional collapsed `<details>` diagnostics block (one `**key**` + fenced
  code block per diagnostic, only rendered when at least one diagnostic is present),
  and the fixed no-linked-account disclaimer.
- `github-issue-creation-error.ts` — `GitHubIssueCreationError`, carrying the HTTP
  `status` GitHub responded with alongside the message — lets a caller distinguish a
  transient 5xx from a permanent 4xx in principle, though `index.ts`'s `fetch` handler
  currently collapses every case to a flat `502` regardless.
- `create-github-issue.ts` — `createGitHubIssue(report, githubPat, fetchImpl?)`. Posts
  to `https://api.github.com/repos/Vaporjawn/Last-FM-Scrobbler/issues` with
  `Authorization: Bearer <pat>`, `Accept: application/vnd.github+json`, and a pinned
  `X-GitHub-Api-Version` header (GitHub's REST API requires this to select a stable
  API version rather than whatever's currently default). Title is prefixed
  `[BUG]: ` to match this project's issue-title convention (see
  `docs/CONTRIBUTING.md`'s commit/issue/branch table).
- `index.ts` — the Worker's `fetch` handler (default export) and the rate limiter (see
  "Rate limiting" below); ties `parseBugReportRequest` → `createGitHubIssue` together
  with the HTTP status mapping listed above.

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
malformed requests, `503` with no `GITHUB_PAT` bound, `429` on the 6th request from one
IP within the rate-limit window, and (first, against a placeholder PAT) a real outbound
call to `https://api.github.com/repos/Vaporjawn/Last-FM-Scrobbler/issues` that 401s and
gets correctly wrapped into a non-leaking `502`. Then, once this repo's owner supplied a
real classic `public_repo`-scoped `GITHUB_PAT` (stored in this directory's gitignored
`.dev.vars`, never committed), a real end-to-end request against that same locally
running Worker actually filed a real issue —
https://github.com/Vaporjawn/Last-FM-Scrobbler/issues/9, confirming the full path works
for real, not just up to a credential boundary.

Not actually deployed to Cloudflare's edge, though — this repo's
`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets haven't been configured, and no
Cloudflare account is authenticated in this development environment (`wrangler login`
needs an interactive browser flow this environment can't run), so the deploy workflow
above hasn't actually run for real yet. The verification above used `wrangler dev`
(fully local, no Cloudflare auth needed) as the closest available substitute. Until a
real deploy happens and `BUG_REPORT_RELAY_URL` is set to that deployment's URL,
`apps/desktop` has no relay to point at by default, and "Report a Bug" correctly (not a
bug) shows "not configured" — see docs/modules/desktop.md.

A separate, real bug *was* found and fixed while verifying this: `apps/desktop`
previously had no mechanism to actually bake a `BUG_REPORT_RELAY_URL` repo secret into
a packaged build at all (setting it during CI packaging did nothing on its own — see
docs/modules/desktop.md's "Bug reporting" section for the full story). That's now
fixed; once this Worker is deployed and `BUG_REPORT_RELAY_URL` is set as a repo secret,
a packaged `apps/desktop` build will actually have it available.

# `services/bug-report-relay`

## Responsibility

Cloudflare Worker. Receives a bug report from `apps/desktop`, validates it, and (once
fully implemented) creates a GitHub issue via a relay-side, repo-scoped
`issues:write` fine-grained PAT — so a reporter never needs a GitHub account and the
credential never ships inside the distributed app. See ADR 0004.

## Public interface (current)

- `parseBugReportRequest(payload: unknown): BugReportRequest` — validates
  `{title, body, diagnostics?}`, throws with a descriptive message on invalid input.
- `fetch(request: Request): Promise<Response>` (default export) — `405` for non-POST,
  `400` for invalid bodies, `501` for well-formed requests (GitHub issue creation isn't
  wired up yet).

## Not yet built

- Actual GitHub REST API call to create the issue.
- Rate limiting / abuse mitigation (a public write-capable endpoint needs this before
  going live — see ADR 0004).
- Issue de-duplication (search before create).

## Dependencies

`wrangler`, `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`.

## Status

Scaffolded: real request validation, fully tested, honest `501` for the unimplemented
part.

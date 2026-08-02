# 0004: Anonymous bug-report relay

## Status

Accepted

## Context

In-app bug reporting should file a GitHub issue without requiring the reporter to have a
GitHub account. A publicly distributed desktop app cannot safely embed a GitHub
write-credential — anyone could extract it from the app binary.

## Decision

`apps/desktop` POSTs `{title, body, diagnostics}` to `services/bug-report-relay`
(Cloudflare Worker), which calls `POST /repos/Vaporjawn/Last-FM-Scrobbler/issues` using a
fine-grained PAT scoped only to `issues:write` on this one repo, stored as a
relay-side secret and never shipped in the app.

## Consequences

- The relay is a public, write-capable endpoint — it needs basic rate limiting at
  minimum; a CAPTCHA (e.g. Cloudflare Turnstile) is a reasonable hardening step if abuse
  becomes real. A best-effort per-IP limit is implemented (see
  `docs/modules/bug-report-relay.md`); a stronger, globally-consistent limit remains a
  future upgrade.
- Diagnostics must never include the user's Last.fm session key or any account
  credential.
- Issue de-duplication (search before create) is a reasonable future enhancement, not
  required for v1.

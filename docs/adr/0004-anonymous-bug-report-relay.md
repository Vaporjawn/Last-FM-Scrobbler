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
classic PAT with the `public_repo` scope, stored as a relay-side secret and never
shipped in the app.

## Consequences

- **PAT choice — classic over fine-grained**: a fine-grained PAT scoped to only this
  repo's `issues:write` would give the relay a strictly narrower credential (this repo
  only, this one permission only). This project deliberately uses a classic PAT with
  `public_repo` instead — this repo owner's explicit choice — which in exchange reaches
  every public repo the token's owner can access, not just this one. That's a real,
  accepted trade-off, not an oversight: the relay code itself only ever calls this one
  repo's issue-creation endpoint regardless of what the token could reach, so the wider
  scope doesn't change what the *relay* does, only what a compromised token could be
  used for by someone else. Revoking/rotating remains available at
  https://github.com/settings/tokens if that ever matters.
- The relay is a public, write-capable endpoint — it needs basic rate limiting at
  minimum; a CAPTCHA (e.g. Cloudflare Turnstile) is a reasonable hardening step if abuse
  becomes real. A best-effort per-IP limit is implemented (see
  `docs/modules/bug-report-relay.md`); a stronger, globally-consistent limit remains a
  future upgrade.
- Diagnostics must never include the user's Last.fm session key or any account
  credential.
- Issue de-duplication (search before create) is a reasonable future enhancement, not
  required for v1.

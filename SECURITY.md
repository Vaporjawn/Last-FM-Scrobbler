# Security Policy

## Supported Versions

This project is pre-1.0 early scaffolding (see [README.md](README.md#status)) with no tagged
releases yet. Only the `main` branch is supported — please make sure you're on the latest commit
before reporting an issue.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report it privately using one of these channels:

1. **Preferred**: [GitHub Security Advisories](https://github.com/Vaporjawn/Last-FM-Scrobbler/security/advisories/new)
   for this repository — this lets us discuss and fix the issue privately before disclosure.
2. **Email**: [victor.williams.dev@gmail.com](mailto:victor.williams.dev@gmail.com) with a description of the
   vulnerability, steps to reproduce, and its potential impact.

You should expect an initial response within 5 business days. This is a hobby/personal project
maintained outside of full-time work, so please be patient — every report is taken seriously and
will be acknowledged.

## Scope

Areas of particular interest for security review, given this project's design (see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):

- **Credential storage**: Last.fm session keys are stored via Electron's `safeStorage`, which
  depends on the OS keyring (Keychain / DPAPI / libsecret-gnome-keyring-kwallet). Issues with how
  or where credentials are persisted are in scope.
- **Electron security posture**: `contextIsolation`, `nodeIntegration`, preload script
  boundaries, and any remote content loading in `apps/desktop`.
- **The bug-report relay** (`services/bug-report-relay`): validation of untrusted, anonymous
  request bodies before they reach the GitHub Issues API.
- **Last.fm API usage**: anything that could leak a user's API key, session key, or scrobble
  history to an unintended party.

## Disclosure

Once a fix is available, we'll coordinate a disclosure timeline with the reporter and credit them
in the fix (unless they prefer to remain anonymous).

# Contributing

## Prerequisites

- Node.js >= 20
- One of: pnpm (`corepack enable`), npm (ships with Node), or Bun. Pick whichever you
  already use — this repo is package-manager agnostic and all three are tested in CI.
  See [docs/adr/0007-package-manager-agnostic.md](adr/0007-package-manager-agnostic.md).

## Setup

```bash
# pnpm
pnpm install && pnpm build && pnpm test

# npm
npm install && npm run build && npm run test

# bun
bun install && bun run build && bun run test
```

## Workspace commands

Run a script in every package: `<pm> run build` / `test` / `lint` / `typecheck` (or
`pnpm build` etc. — pnpm alone also accepts the shorter form without `run`).
Run a script in one package directly: `cd packages/core && <pm> run test`.

## Testing cadence

While working on a change, run targeted tests for the package you're touching
(`cd packages/<name> && <pm> run test`). Run the full workspace suite (`<pm> run test`)
once, as a final check, before opening a PR.

## Test-driven development

This project is built test-first. `packages/core`'s test suite runs entirely against
mocked HTTP (no Last.fm credentials needed) — you do not need a real Last.fm API key to
run the test suite. A real key is only needed for manual end-to-end testing against the
live API; ask a maintainer for a development key if you need one.

## Commit, issue, and branch naming conventions

One category set, applied consistently across three places:

| Category | Commit subject | GitHub issue title | Branch name |
|---|---|---|---|
| Bug fix | `[BUG]: title` | `[BUG]: title` | `bug/title` |
| New feature | `[FEATURE]: title` | `[FEATURE]: title` | `feature/title` |
| Planned task / non-bug work item | `[TASK]: title` | `[TASK]: title` | `task/title` |
| Tooling, infra, no user-facing behavior change | `[CHORE]: title` | `[CHORE]: title` | `chore/title` |

Branch `title` segments are kebab-case (e.g. `feature/mpris-playback-source`).

- Stage files by exact path (`git add path/to/file`) — never `git add -A` or `git add .`.
- One commit per logically-complete change, not a giant commit for a whole session and
  not a flurry of micro-commits for one feature's sub-steps.
- Commits do not carry AI/Claude co-author trailers, regardless of what tooling was used
  to help write them.

## Accessibility

Keyboard navigation must work throughout the desktop app. Prefer MUI's built-in
accessibility behavior (labels, focus order, ARIA roles) over overriding it.

## Last.fm API usage

This project uses the Last.fm API under Last.fm's API Terms of Service
(https://www.last.fm/api/tos). Don't exceed documented rate limits in adapters or
manual testing.

## Pull requests

Describe what changed and why. Link the relevant `docs/adr/` entry if the change touches
an architectural decision recorded there.

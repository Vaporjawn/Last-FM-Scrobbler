# Contributing

## Prerequisites

- Node.js >= 20
- `corepack enable` (pins the exact pnpm version from root `package.json`)

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

## Workspace commands

Run a script in every package: `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm typecheck`.
Run a script in one package: `pnpm --filter @lastfm-scrobbler/core test`.

## Testing cadence

While working on a change, run targeted tests for the package you're touching
(`pnpm --filter <package> test`). Run the full workspace suite (`pnpm test`) once, as a
final check, before opening a PR.

## Test-driven development

This project is built test-first. `packages/core`'s test suite runs entirely against
mocked HTTP (no Last.fm credentials needed) — you do not need a real Last.fm API key to
run `pnpm test`. A real key is only needed for manual end-to-end testing against the
live API; ask a maintainer for a development key if you need one.

## Commit conventions

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

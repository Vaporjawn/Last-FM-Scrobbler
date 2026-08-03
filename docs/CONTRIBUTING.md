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

## Environment variables for local development

`apps/desktop` runs and builds fine with zero environment variables set — Last.fm
login falls back to "bring your own key" (a form in Settings → Accounts), and features
that need a service this repo hasn't configured (Libre.fm, the bug-report relay)
degrade to a clear "not configured" state rather than erroring. If you want a baked-in
Last.fm key, Libre.fm support, or a working "Report a Bug" button during local
development, create a git-ignored `apps/desktop/.env` — see
[docs/modules/desktop.md](modules/desktop.md)'s "Required environment variables" for
the exact variable names and where to obtain each value. Never commit a real key/secret
to any tracked file.

## Native adapter prerequisites (only if you're touching an adapter)

`packages/adapter-macos` and `packages/adapter-windows` each have a native build step
that only runs on their matching OS (a no-op elsewhere, so the rest of the workspace's
`build`/`test` is unaffected) — you only need these if you're changing that specific
adapter's native helper:

- **macOS** (`adapter-macos`): CMake + Xcode command line tools, to compile the
  vendored `MediaRemoteAdapter.framework`. Run
  `pnpm --filter @lastfm-scrobbler/adapter-macos build:native` (or just `build`, which
  runs it first) — see [docs/modules/adapter-macos.md](modules/adapter-macos.md).
- **Windows** (`adapter-windows`): the .NET 8 SDK, to compile/publish `SmtcHelper.exe`.
  Run `pnpm --filter @lastfm-scrobbler/adapter-windows build:native` (or just `build`)
  — see [docs/modules/adapter-windows.md](modules/adapter-windows.md). The C# side can
  be compiler-verified from any OS (`EnableWindowsTargeting=true`, see
  [ADR 0009](adr/0009-windows-smtc-integration.md)), but actually running the published
  helper needs real Windows.
- **Linux** (`adapter-linux`): no native build step (pure JS), but its real-D-Bus smoke
  test needs a `dbus-daemon` binary on `PATH` — it skips itself, rather than failing,
  when one isn't found.

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

| Category                                       | Commit subject     | GitHub issue title | Branch name     |
| ---------------------------------------------- | ------------------ | ------------------ | --------------- |
| Bug fix                                        | `[BUG]: title`     | `[BUG]: title`     | `bug/title`     |
| New feature                                    | `[FEATURE]: title` | `[FEATURE]: title` | `feature/title` |
| Planned task / non-bug work item               | `[TASK]: title`    | `[TASK]: title`    | `task/title`    |
| Tooling, infra, no user-facing behavior change | `[CHORE]: title`   | `[CHORE]: title`   | `chore/title`   |

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

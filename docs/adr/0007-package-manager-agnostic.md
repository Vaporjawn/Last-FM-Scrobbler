# 0007: Package-manager agnostic (pnpm, npm, and Bun)

## Status

Accepted

## Context

The repo initially assumed pnpm specifically: `pnpm-workspace.yaml`, `workspace:*`
dependency specifiers, and `pnpm -r --if-present <script>` in root scripts. Requirement:
contributors should be able to use pnpm, npm, or Bun interchangeably.

Every claim below was verified by actually running the relevant package manager against
a real fixture (and, for the Turborepo question, three different fixture variants) —
not inferred from documentation alone, several of which turned out to be wrong or
incomplete on exactly this topic.

## Decision

**Internal workspace dependencies** use a plain exact-version specifier (e.g. `"0.0.0"`,
matching the referenced package's own `"version"` field) instead of `"workspace:*"`.
npm has no concept of the `workspace:` protocol at all — it fails outright trying to
fetch a package literally named that. Bun and pnpm both support plain semver
specifiers for workspace linking, so this one syntax works natively in all three.
pnpm needs one extra setting for it: `linkWorkspacePackages: true` in
`pnpm-workspace.yaml` — without it, pnpm tries the real npm registry for a bare version
specifier and 404s, even though the local workspace package satisfies it.

**Workspace declaration** exists in two places, each read by the tools that need it:
`pnpm-workspace.yaml` (pnpm only reads this, confirmed via its own docs — no
package.json fallback) and `package.json`'s `"workspaces"` array (required by both npm
and Bun; pnpm ignores it).

**Task running** is a small hand-rolled script (`scripts/run-workspaces.mjs`), not
Turborepo. Turborepo was the initial plan — it's the reputationally "standard" choice
for exactly this scenario — but empirical testing (three separate attempts, including
`devEngines.packageManager` as an array with `onFail: "ignore"`) confirmed it hard-requires
declaring exactly one package manager via a single-object `packageManager` or
`devEngines.packageManager` field before it will run at all. That's the opposite of
"agnostic," so it was dropped in favor of a script with no such requirement.

`scripts/run-workspaces.mjs` detects which manager invoked it via the
`npm_config_user_agent` environment variable — confirmed empirically to be set
correctly by npm, pnpm, and Bun alike when they run a `package.json` script — and
dispatches to that same manager per workspace package (topologically sorted by each
package's `@lastfm-scrobbler/*` dependencies, so `shared-types` always builds before
its dependents). Falls back to npm if the variable is absent (e.g. invoked directly via
`node scripts/run-workspaces.mjs`, not through a package manager's `run` command).

**`packageManager: "pnpm@11.18.0"` stays in `package.json`.** This looked like it
needed to be removed for "agnostic" to mean anything, but removing it caused a real
failure: Corepack (which intercepts `pnpm`/`yarn` invocations specifically — not `npm`,
which ships with Node directly, and not Bun, a fully separate runtime) walks _up the
directory tree_ looking for the nearest `package.json` with a `packageManager` field
when the current project doesn't have one, with no regard for `.git` or workspace
boundaries. In this environment that picked up an unrelated `packageManager: yarn`
field from a `package.json` several directories above the repo root, and pnpm stopped
working entirely. Keeping the field pins pnpm's own version for reproducibility and
stops Corepack's upward search — npm and Bun are unaffected either way, since neither
goes through Corepack's enforcement.

**Lockfiles**: all three (`pnpm-lock.yaml`, `package-lock.json`, `bun.lock`) are
committed, and CI runs the full `build && typecheck && lint && test` sequence under
all three package managers across all three OSes (9 jobs) — continuously proving the
claim rather than asserting it once and letting it silently rot.

## Consequences

- Bumping an internal package's version now requires updating every dependent's
  specifier by hand (no `workspace:*` auto-tracking). Acceptable at this scale; revisit
  with tooling like `syncpack` if the package count grows enough to make it painful.
- CI cost triples (9 jobs instead of 3) for the genuine continuous proof this works.
- `scripts/run-workspaces.mjs` is bespoke, unpublished code rather than a maintained
  package — a deliberate trade against Turborepo's hard single-manager requirement.

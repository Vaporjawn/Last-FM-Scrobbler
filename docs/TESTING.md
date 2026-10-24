# Testing Strategy

| Layer                       | Approach                                                                                                                    | Command (any pm: `cd <dir> && <pm> run test`) |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `packages/core`             | Vitest, HTTP mocked, TDD-first                                                                                              | `cd packages/core && pnpm test`               |
| `packages/shared-types`     | Type-only — verified via `tsc --noEmit`, no runtime tests                                                                   | `cd packages/shared-types && pnpm typecheck`  |
| `packages/adapter-*`        | Unit tests against the `PlaybackSource` contract; real-API smoke tests are gated to run only on the matching OS's CI runner | `cd packages/adapter-linux && pnpm test`      |
| `apps/desktop`              | Component tests (Vitest + React Testing Library); Playwright Electron E2E smoke tests (`apps/desktop/e2e/`)                 | `cd apps/desktop && pnpm test`                |
| `services/bug-report-relay` | Vitest via `@cloudflare/vitest-pool-workers` (runs against the real Workers runtime, not a Node shim), GitHub API mocked    | `cd services/bug-report-relay && pnpm test`   |

## CI

GitHub Actions runs a 3×3 matrix: pnpm/npm/bun across `ubuntu-latest`,
`windows-latest`, and `macos-latest` — 9 jobs per PR. Each job runs
`build && typecheck && lint && test:coverage` via its own package manager (see
[docs/adr/0007-package-manager-agnostic.md](adr/0007-package-manager-agnostic.md)).
Build runs first — the `adapter-*` packages resolve `@lastfm-scrobbler/shared-types`
via its declared `types` field, which only exists once `shared-types` is built, so
typecheck must come after build on a fresh checkout. Adapter packages' real-API smoke
tests only run on their matching OS, regardless of which package manager's job it is.

## Coverage

Every package with runtime code (`packages/core`, `packages/adapter-*`, `apps/desktop`,
`services/bug-report-relay`) must stay at **100% statements, branches, functions and
lines**. Each package's `vitest.config.ts` sets those as `coverage.thresholds`, so
`<pm> run test:coverage` (root, or per package) fails the moment any of them drops —
and CI runs exactly that command.

- **Provider**: V8 everywhere except `services/bug-report-relay`, which uses Istanbul —
  the Workers runtime (workerd) cannot host V8's native coverage collector, so
  `@cloudflare/vitest-pool-workers` only supports instrumented coverage.
- **Scope**: all files under `src/` (including ones no test imports yet), not just the
  files tests happen to load.
- **Platform-gated tests don't count toward it**: the adapters' real-API smoke tests
  only run on their own OS, so the unit tests alone must reach 100%.
- **Unreachable defensive code**: prefer deleting the branch or reshaping the types so it
  cannot exist (a discriminated union, `charAt` instead of an index plus an `undefined`
  guard). Only when that is not possible, annotate it with
  `/* v8 ignore start -- @preserve */ … /* v8 ignore stop -- @preserve */` plus the
  reason. The `@preserve` is required: esbuild strips ordinary comments, so a bare
  `// v8 ignore next` silently does nothing.
- **Pinned provider versions**: `@vitest/coverage-v8` / `@vitest/coverage-istanbul` are
  pinned to the exact vitest version (the repo overrides `vitest` to one version, and a
  provider's peer dependency must match it).

## E2E (apps/desktop)

`apps/desktop/e2e/` holds Playwright Electron tests that launch the real, built main
process (`out/main/index.js`) via `_electron.launch()` and drive the actual renderer
window — not a mock or a component-level render. Run with:

```
cd apps/desktop && pnpm build && pnpm test:e2e
```

These tests need a real, connected display (a real WindowServer/X11/Wayland/desktop
session) to create an Electron `BrowserWindow` — headless shells with no display
attached cannot run them; the Electron process starts but `electronApplication.
firstWindow()` never resolves, since no renderer window is ever created. On Linux CI
this means running under a virtual display (e.g. `xvfb-run`); `windows-latest` and
`macos-latest` GitHub Actions runners provide a real desktop session already. This repo
does not currently run `test:e2e` in CI — see the config's own doc comment in
`apps/desktop/playwright.config.ts` for the full explanation.

## Accessibility

Component tests for interactive UI (navigation, forms) should query by role/label
(`getByRole`, `getByLabelText`) rather than by test-id, so tests double as a check that
the markup is actually accessible.

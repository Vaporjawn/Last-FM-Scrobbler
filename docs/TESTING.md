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
`build && typecheck && lint && test` via its own package manager (see
[docs/adr/0007-package-manager-agnostic.md](adr/0007-package-manager-agnostic.md)).
Build runs first — the `adapter-*` packages resolve `@lastfm-scrobbler/shared-types`
via its declared `types` field, which only exists once `shared-types` is built, so
typecheck must come after build on a fresh checkout. Adapter packages' real-API smoke
tests only run on their matching OS, regardless of which package manager's job it is.

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

# Testing Strategy

| Layer | Approach | Command |
|---|---|---|
| `packages/core` | Vitest, HTTP mocked, TDD-first | `pnpm --filter @lastfm-scrobbler/core test` |
| `packages/shared-types` | Type-only — verified via `tsc --noEmit`, no runtime tests | `pnpm --filter @lastfm-scrobbler/shared-types typecheck` |
| `packages/adapter-*` | Unit tests against the `PlaybackSource` contract; real-API smoke tests are gated to run only on the matching OS's CI runner | `pnpm --filter @lastfm-scrobbler/adapter-linux test` |
| `apps/desktop` | Component tests (Vitest + React Testing Library); Playwright Electron E2E smoke tests come once real views exist | `pnpm --filter @lastfm-scrobbler/desktop test` |
| `services/bug-report-relay` | Vitest via `@cloudflare/vitest-pool-workers` (runs against the real Workers runtime, not a Node shim), GitHub API mocked | `pnpm --filter @lastfm-scrobbler/bug-report-relay test` |

## CI

GitHub Actions runs `pnpm build && pnpm typecheck && pnpm lint && pnpm test` on
`ubuntu-latest`, `windows-latest`, and `macos-latest` for every PR. Build runs first —
the `adapter-*` packages resolve `@lastfm-scrobbler/shared-types` via its declared
`types` field, which only exists once `shared-types` is built, so typecheck must come
after build on a fresh checkout. Adapter packages' real-API smoke tests only run on
their matching OS.

## Accessibility

Component tests for interactive UI (navigation, forms) should query by role/label
(`getByRole`, `getByLabelText`) rather than by test-id, so tests double as a check that
the markup is actually accessible.

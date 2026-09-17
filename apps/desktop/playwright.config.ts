import { defineConfig } from "@playwright/test";

/**
 * Playwright config for Electron E2E smoke tests (apps/desktop/e2e/).
 *
 * These tests launch the real, built app (via `_electron.launch({ args: ["."] })`,
 * which resolves the entry point the same way a packaged build does — through
 * `package.json`'s `main` field) and drive the actual renderer window — this is the
 * "Playwright Electron E2E smoke tests" step that docs/TESTING.md has documented,
 * since the project's inception, as coming "once real views exist." Real views exist
 * now, so this file wires that plan up for real.
 *
 * **Launch with the app directory (`["."]`), never a bare `out/main/index.js` file
 * argument** — verified live that the two are NOT equivalent. Given a literal
 * script-file argument, Electron never establishes a real app root, so
 * `app.getAppPath()` resolves to the script's own directory (`out/main`) instead of
 * `apps/desktop`, breaking every `resources/`-relative dev-mode lookup this app makes
 * (see `resolve-app-icon-path.ts`) — and in at least one real sandboxed environment,
 * the main window never appeared at all (no renderer process ever started, with no
 * error surfaced anywhere). Easy to misdiagnose as "no display attached" (the failure
 * mode described below) since the symptom is identical; check the launch args first.
 *
 * Prerequisites to run locally:
 *   1. `npm run build` (or `pnpm build` / `bun run build`) in apps/desktop first —
 *      these tests launch the built app, not the dev server.
 *   2. A real, connected display. Electron needs an actual WindowServer (macOS) /
 *      X11 or Wayland compositor (Linux) / desktop session (Windows) to create a
 *      BrowserWindow — headless shells with no display attached (e.g. some sandboxed
 *      CI or agent execution contexts) cannot run these tests; the Electron process
 *      starts but no renderer window is ever created. CI runners need a virtual
 *      display (e.g. `xvfb-run` on Linux) for exactly this reason.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
});

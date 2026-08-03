import { defineConfig } from "@playwright/test";

/**
 * Playwright config for Electron E2E smoke tests (apps/desktop/e2e/).
 *
 * These tests launch the real, packaged main process (`out/main/index.js`) via
 * `_electron.launch()` and drive the actual renderer window — this is the
 * "Playwright Electron E2E smoke tests" step that docs/TESTING.md has documented,
 * since the project's inception, as coming "once real views exist." Real views exist
 * now, so this file wires that plan up for real.
 *
 * Prerequisites to run locally:
 *   1. `npm run build` (or `pnpm build` / `bun run build`) in apps/desktop first —
 *      these tests launch the built `out/main/index.js`, not the dev server.
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

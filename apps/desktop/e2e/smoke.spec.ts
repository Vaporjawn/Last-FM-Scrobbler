import { _electron as electron, expect, test } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";

// Requires a real, connected display — see the prerequisites note in
// ../playwright.config.ts and docs/TESTING.md's "E2E (apps/desktop)" section.
let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  // Launching with the app's own directory (matching how a real packaged build and
  // `electron-vite dev` both resolve the entry point via `package.json`'s `main`
  // field), not a bare `out/main/index.js` file argument. Verified live that the two
  // are NOT equivalent: given a literal script-file argument, Electron never
  // establishes a real app root, so `app.getAppPath()` resolves to the script's own
  // directory (`out/main`) instead of `apps/desktop` — confirmed breaking the
  // `resources/`-relative dev-mode icon lookup (see `resolve-app-icon-path.ts`), and,
  // in this environment, the main window never appeared at all (no renderer process
  // ever started) — swapping in `args: ["."]` alone reliably fixed both.
  app = await electron.launch({ args: ["."] });
  window = await app.firstWindow();
});

test.afterAll(async () => {
  await app.close();
});

test("launches and shows the Now Playing view by default", async () => {
  await expect(window.getByRole("heading", { name: "Now Playing" })).toBeVisible();
});

import { _electron as electron, expect, test } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";

// Requires a real, connected display — see the prerequisites note in
// ../playwright.config.ts and docs/TESTING.md's "E2E (apps/desktop)" section.
let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  app = await electron.launch({ args: ["out/main/index.js"] });
  window = await app.firstWindow();
});

test.afterAll(async () => {
  await app.close();
});

test("launches and shows the Now Playing view by default", async () => {
  await expect(window.getByRole("heading", { name: "Now Playing" })).toBeVisible();
});

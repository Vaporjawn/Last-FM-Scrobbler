#!/usr/bin/env node
// Launches the PACKAGED app (not `electron .` from source) and checks that it really
// starts: the renderer loads, the Now Playing view renders, and — when the build was
// made with Last.fm credentials — Settings offers "Log in with Last.fm" rather than
// the bring-your-own-key form (i.e. the baked key reached the shipped binary).
//
// Why this exists: unit tests and `npm run build` can all be green while the packaged
// artifact is dead (a missing unpacked native module, an asar path problem, a key that
// never got inlined). Only launching the artifact shows that.
//
// Env:
//   SMOKE_EXECUTABLE            path to the packaged app's executable (required)
//   SMOKE_EXPECT_LASTFM_LOGIN   "1" to also require the baked-key login button
import { _electron as electron } from "@playwright/test";

const executablePath = process.env.SMOKE_EXECUTABLE;
if (!executablePath) {
  console.error("SMOKE_EXECUTABLE is not set.");
  process.exit(2);
}

// The Chromium sandbox helper in an unpacked Linux build is not setuid on CI runners.
const args = [
  ...(process.platform === "linux" ? ["--no-sandbox"] : []),
  ...(process.env.SMOKE_EXTRA_ARGS ? process.env.SMOKE_EXTRA_ARGS.split(" ") : []),
];
const app = await electron.launch({ executablePath, args, timeout: 60_000 });

try {
  // `app.firstWindow()` is not reliably the main window: the app also creates a hidden
  // tray popover window, and which one Playwright reports first varies by platform
  // (the first dry run found the heading on Linux but not on macOS/Windows). Poll every
  // window until one actually renders the Now Playing heading.
  const deadline = Date.now() + 60_000;
  let mainWindow;
  while (!mainWindow && Date.now() < deadline) {
    for (const candidate of app.windows()) {
      const heading = candidate.getByRole("heading", { name: "Now Playing" });
      if (await heading.isVisible().catch(() => false)) {
        mainWindow = candidate;
        break;
      }
    }
    if (!mainWindow) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!mainWindow) {
    const seen = await Promise.all(
      app.windows().map(async (w) => `${w.url()} :: ${await w.title().catch(() => "?")}`),
    );
    throw new Error(`No window rendered the Now Playing heading. Windows: ${seen.join(" | ")}`);
  }
  console.log("ok: packaged app launched and rendered the Now Playing view");

  if (process.env.SMOKE_EXPECT_LASTFM_LOGIN === "1") {
    await mainWindow.getByRole("button", { name: "Settings", exact: true }).click();
    try {
      await mainWindow
        .getByRole("button", { name: "Log in with Last.fm" })
        .waitFor({ timeout: 30_000 });
    } catch (error) {
      // Say what the page actually shows, so a CI log is enough to diagnose it.
      const text = await mainWindow
        .locator("body")
        .innerText()
        .catch(() => "(unreadable)");
      console.error(`Settings did not offer the login button. Page text:\n${text}`);
      throw error;
    }
    console.log("ok: Settings offers 'Log in with Last.fm' (baked key reached the build)");
  }
} finally {
  await app.close();
}

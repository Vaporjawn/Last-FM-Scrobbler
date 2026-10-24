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
const args = process.platform === "linux" ? ["--no-sandbox"] : [];
const app = await electron.launch({ executablePath, args, timeout: 60_000 });

try {
  const window = await app.firstWindow();
  await window.getByRole("heading", { name: "Now Playing" }).waitFor({ timeout: 45_000 });
  console.log("ok: packaged app launched and rendered the Now Playing view");

  if (process.env.SMOKE_EXPECT_LASTFM_LOGIN === "1") {
    await window.getByText("Settings", { exact: true }).first().click();
    await window.getByRole("button", { name: "Log in with Last.fm" }).waitFor({ timeout: 30_000 });
    console.log("ok: Settings offers 'Log in with Last.fm' (baked key reached the build)");
  }
} finally {
  await app.close();
}

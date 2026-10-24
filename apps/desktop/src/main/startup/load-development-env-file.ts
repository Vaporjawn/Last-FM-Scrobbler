import { existsSync } from "node:fs";
import { join } from "node:path";
import electron from "electron";

const { app } = electron;

/**
 * Local dev convenience: a git-ignored `apps/desktop/.env` file (already covered by
 * the repo's root .gitignore) lets LASTFM_API_KEY/LASTFM_API_SECRET/
 * BUG_REPORT_RELAY_URL persist across `npm run dev` launches instead of needing to
 * be re-exported in the shell every time — set them once, they just keep working.
 * Dev only: a packaged build has no reason to read a loose text file for secrets,
 * and `app.getAppPath()` wouldn't point at a useful location for one anyway once
 * packaged (see resolve-app-icon-path.ts's docstring on the same asar distinction).
 * This project still never *generates* or hardcodes a real key anywhere — getting
 * one from Last.fm is still on whoever runs this, same as always (see
 * docs/modules/desktop.md); this only makes *using* one less repetitive once you
 * have it. `process.loadEnvFile` is a built-in Node API (stable since Node
 * 22.21/24.10, available since 20.12) — no new dependency needed for this.
 *
 * Deliberately placed here, inside `whenReady()`, rather than at module top level
 * (its original location, moved as part of the same fix documented in
 * create-updater-client.ts): this project's ESM main-process entry point loads via
 * Node's async ESM entry-point runner, which — verified live, this exact crash —
 * does not guarantee `electron.app`'s properties are populated yet at module
 * top-level evaluation time, only by the time `whenReady()` actually resolves.
 * Every other `app.*` access in this file already correctly waits for this same
 * callback; this one just hadn't been exercised by a genuine cold start before.
 */
export function loadDevelopmentEnvFile(): void {
  if (!app.isPackaged) {
    const envFilePath = join(app.getAppPath(), ".env");
    if (existsSync(envFilePath)) {
      process.loadEnvFile(envFilePath);
    }
  }
}

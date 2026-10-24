import { fileURLToPath } from "node:url";
import electron from "electron";
import { createPlatformPlaybackSource } from "./playback/create-platform-playback-source.js";
import { resolveExpectedRendererOrigin } from "./resolve-expected-renderer-origin.js";
import { createAppLogger } from "./startup/create-app-logger.js";
import { quitWhenAllWindowsClosed } from "./startup/quit-when-all-windows-closed.js";
import { startApplication } from "./startup/start-application.js";

// Electron's main-process module is CJS with a non-standard export shape that Node's
// static ESM/CJS interop can't always detect named exports from (some properties are
// defined in a way `cjs-module-lexer` misses) — importing the default and destructuring
// at runtime sidesteps that entirely. See docs/modules/desktop.md for the exact error
// this fixes if reverted.
const { app } = electron;

// Mirrors create-main-window.ts's own `dirname` — both files live in `src/main/`, so
// the same "one level up into renderer/" relative resolution
// `resolveExpectedRendererOrigin` does lands on the exact same file `createMainWindow`
// itself loads via `loadFile`. Computed once at module scope (matching
// create-main-window.ts's own `dirname` — this doesn't change over the app's
// lifetime) and passed to `startApplication`, which hands it to every `wire*` call so their
// handlers can verify a call's `senderFrame` genuinely is this app's own renderer, not some
// other page (see assert-trusted-sender.ts).
const dirname = fileURLToPath(new URL(".", import.meta.url));
const expectedRendererOrigin = resolveExpectedRendererOrigin(
  dirname,
  process.env.ELECTRON_RENDERER_URL,
);

// Bounded ring buffer of recent log lines, attached to bug reports as diagnostics (see
// wireBugReportDiagnostics) — never logs credentials (session keys, API secrets), only
// operational messages like "adapter construction failed" or "relay returned 502".
const logger = createAppLogger();

// Constructed once at app startup, not per-window: it may spawn a real OS-level
// process (see packages/adapter-macos), and there should only ever be one of those
// per app instance regardless of how many windows come and go.
const playbackSource = createPlatformPlaybackSource((message) => {
  logger.warn(message);
});

void app
  .whenReady()
  .then(() => startApplication({ expectedRendererOrigin, logger, playbackSource }));

app.on("window-all-closed", quitWhenAllWindowsClosed);

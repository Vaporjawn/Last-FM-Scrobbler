// @vitest-environment node
//
// Same reasoning as create-main-window.test.ts's own header comment: the module
// under test resolves its own directory via `fileURLToPath(new URL(".",
// import.meta.url))` at import time, which throws under the project's default jsdom
// environment - run this file under the real "node" environment instead.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeBrowserWindow extends EventEmitter {
  loadURL = vi.fn().mockResolvedValue(undefined);
  loadFile = vi.fn().mockResolvedValue(undefined);
  hide = vi.fn();
  webContents = {
    on: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    session: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() },
  };

  constructor(public readonly options: Record<string, unknown>) {
    super();
  }
}

const shell = vi.hoisted(() => ({ openExternal: vi.fn() }));

vi.mock("electron", () => ({
  BrowserWindow: FakeBrowserWindow,
  shell,
  default: { BrowserWindow: FakeBrowserWindow, shell },
}));

const { createTrayPopoverWindow } =
  await import("../../../src/main/tray/create-tray-popover-window.js");

/** The real, on-disk directory of the module under test - independently computed here
 * (not copy-pasted from its source) so this test can assert the *exact* expected
 * `loadFile` path without duplicating a magic relative-path literal that could be
 * wrong in the same way the bug this test guards against was. Both this file and the
 * module under test sit at the same depth under `apps/desktop/` (`tests/main/tray/`
 * and `src/main/tray/` respectively), so resolving from here mirrors what
 * `fileURLToPath(new URL(".", import.meta.url))` computes for the *bundled*
 * `out/main/index.js` at runtime closely enough to prove the path arithmetic itself
 * is right: exactly one `..` segment above this module's own directory, landing in a
 * sibling `renderer/` folder - not two. */
const sourceModuleDir = dirname(
  fileURLToPath(import.meta.resolve("../../../src/main/tray/create-tray-popover-window.js")),
);
const EXPECTED_RENDERER_HTML_PATH = join(sourceModuleDir, "../renderer/index.html");

describe("createTrayPopoverWindow", () => {
  // `vi.stubEnv`/`unstubAllEnvs`, not direct `process.env` mutation - @types/node's
  // `ProcessEnv` is typed as a readonly `Dict<string>` here, so `delete`/assignment
  // are both compile errors; Vitest's own env-stubbing helpers exist for exactly
  // this and restore the original value (or absence of one) automatically.
  beforeEach(() => {
    vi.stubEnv("ELECTRON_RENDERER_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loads the built renderer HTML one directory above its own bundled location, not two", () => {
    // Regression test for a real bug: an extra `../` here made this resolve to
    // `apps/desktop/renderer/index.html` (doesn't exist) instead of
    // `apps/desktop/out/renderer/index.html` (the actual build output) - which
    // loaded a Chromium ERR_FILE_NOT_FOUND error page instead of any real content
    // any time `ELECTRON_RENDERER_URL` isn't set (a packaged build, or any
    // built-output-based launch/test). Silent under normal `electron-vite dev` only
    // because that always takes the `loadURL` branch below instead.
    const popover = createTrayPopoverWindow() as unknown as FakeBrowserWindow;

    expect(popover.loadFile).toHaveBeenCalledWith(EXPECTED_RENDERER_HTML_PATH, {
      hash: "tray-popover",
    });
    expect(popover.loadURL).not.toHaveBeenCalled();
  });

  it("loads the dev server URL with the tray-popover hash when ELECTRON_RENDERER_URL is set", () => {
    vi.stubEnv("ELECTRON_RENDERER_URL", "http://localhost:5173");

    const popover = createTrayPopoverWindow() as unknown as FakeBrowserWindow;

    expect(popover.loadURL).toHaveBeenCalledWith("http://localhost:5173#tray-popover");
    expect(popover.loadFile).not.toHaveBeenCalled();
  });

  it("hides itself when it loses focus", () => {
    const popover = createTrayPopoverWindow() as unknown as FakeBrowserWindow;

    popover.emit("blur");

    expect(popover.hide).toHaveBeenCalledTimes(1);
  });

  it("is locked to its own page and sends links to the real browser", () => {
    const popover = createTrayPopoverWindow() as unknown as FakeBrowserWindow;

    const hooked = popover.webContents.on.mock.calls.map((call) => call[0] as string);
    expect(hooked).toEqual(
      expect.arrayContaining(["will-navigate", "will-redirect", "will-attach-webview"]),
    );
    expect(popover.webContents.session.setPermissionCheckHandler).toHaveBeenCalledTimes(1);

    const handler = popover.webContents.setWindowOpenHandler.mock.calls[0]?.[0] as (details: {
      url: string;
    }) => { action: string };
    expect(handler({ url: "https://www.last.fm/" })).toEqual({ action: "deny" });
    expect(shell.openExternal).toHaveBeenCalledWith("https://www.last.fm/");
  });
});

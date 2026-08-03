// @vitest-environment node
//
// This suite's target module (create-main-window.ts) resolves its own directory via
// `fileURLToPath(new URL(".", import.meta.url))` at import time — under this project's
// default jsdom test environment, that throws ("The URL must be of scheme file")
// rather than resolving to a real file:// URL. No prior test imported this file
// directly (hence never hitting it) — main-process code has no actual DOM
// dependency, so running this one file under the real "node" environment instead
// (Vitest's documented per-file override) sidesteps the incompatibility entirely
// rather than working around it inside application code.
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaybackSource, PlaybackState, TrackInfo, Unsubscribe } from "@lastfm-scrobbler/shared-types";

const ipcMainHandlers = new Map<string, (...args: unknown[]) => unknown>();
const ipcMain = {
  handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    // Mirrors Electron's real, documented behavior — a real second `ipcMain.handle`
    // call for the same channel throws synchronously. This is exactly the failure
    // mode the Critical bug this test file exists to catch actually hit.
    if (ipcMainHandlers.has(channel)) {
      throw new Error(`Attempted to register a second handler for '${channel}'`);
    }
    ipcMainHandlers.set(channel, handler);
  }),
  removeHandler: vi.fn((channel: string) => {
    ipcMainHandlers.delete(channel);
  }),
};

class FakeWebContents {
  send = vi.fn();
  setWindowOpenHandler = vi.fn();
}

const createdWindows: FakeBrowserWindow[] = [];

class FakeBrowserWindow extends EventEmitter {
  webContents = new FakeWebContents();
  setAspectRatio = vi.fn();
  show = vi.fn();
  loadURL = vi.fn().mockResolvedValue(undefined);
  loadFile = vi.fn().mockResolvedValue(undefined);
  private destroyed = false;

  constructor(public readonly options: Record<string, unknown>) {
    super();
    createdWindows.push(this);
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  /** Simulates the window actually closing (real user close, or a test tearing it
   * down) — fires the same "closed" event a real BrowserWindow does. */
  close(): void {
    this.destroyed = true;
    this.emit("closed");
  }
}

/** A single, generously-sized fake display covering both primary-display and
 * matched-display lookups — most tests don't care about multi-monitor specifics; the
 * dedicated "restored position" describe block below overrides this per-test. */
function fakeDisplay(workArea: { x: number; y: number; width: number; height: number }) {
  return { workArea } as Electron.Display;
}

let primaryDisplay = fakeDisplay({ x: 0, y: 0, width: 1920, height: 1080 });
let displayMatchingResult = primaryDisplay;

const screenMock = {
  getDisplayMatching: vi.fn(() => displayMatchingResult),
  getPrimaryDisplay: vi.fn(() => primaryDisplay),
};

const shellMock = { openExternal: vi.fn().mockResolvedValue(undefined) };

vi.mock("electron", () => ({
  BrowserWindow: FakeBrowserWindow,
  ipcMain,
  screen: screenMock,
  shell: shellMock,
  default: { BrowserWindow: FakeBrowserWindow, ipcMain, screen: screenMock, shell: shellMock },
}));

const { createMainWindow, MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT } = await import(
  "../../src/main/create-main-window.js"
);
const { IPC_CHANNELS } = await import("../../src/shared/ipc-channels.js");

/** A fake `PlaybackSource` whose subscription methods are real enough to exercise
 * `wireNowPlaying`'s own subscribe/unsubscribe bookkeeping — not a mock of the
 * interface itself. */
function createFakeSource(): PlaybackSource {
  const trackListeners = new Set<(track: TrackInfo) => void>();
  const stateListeners = new Set<(state: PlaybackState) => void>();
  return {
    onTrackChanged(callback): Unsubscribe {
      trackListeners.add(callback);
      return () => trackListeners.delete(callback);
    },
    onPlaybackStateChanged(callback): Unsubscribe {
      stateListeners.add(callback);
      return () => stateListeners.delete(callback);
    },
    getPosition: () => Promise.resolve(0),
  };
}

describe("createMainWindow", () => {
  beforeEach(() => {
    ipcMainHandlers.clear();
    createdWindows.length = 0;
    primaryDisplay = fakeDisplay({ x: 0, y: 0, width: 1920, height: 1080 });
    displayMatchingResult = primaryDisplay;
  });

  it("does not throw when recreating the window after the previous one closed", () => {
    // Regression test for the Critical bug: wireNowPlaying's cleanup used to be
    // discarded entirely, so a second createMainWindow call (window recreated after
    // being closed — "close to tray" off, then reopened via the Dock icon) hit
    // Electron's real "second handler for the same channel" throw.
    const source = createFakeSource();

    const first = createMainWindow({ playbackSource: source });
    (first as unknown as FakeBrowserWindow).close();

    expect(() => {
      createMainWindow({ playbackSource: source });
    }).not.toThrow();
  });

  it("unregisters the get-current IPC handler when the window closes", () => {
    const source = createFakeSource();

    const window = createMainWindow({ playbackSource: source });
    expect(ipcMainHandlers.has(IPC_CHANNELS.nowPlayingGetCurrent)).toBe(true);

    (window as unknown as FakeBrowserWindow).close();

    expect(ipcMainHandlers.has(IPC_CHANNELS.nowPlayingGetCurrent)).toBe(false);
  });

  describe("restored window position", () => {
    it("uses the saved x/y when it's still on a connected display", () => {
      createMainWindow({
        playbackSource: undefined,
        initialBounds: { x: 100, y: 100, width: 900, height: 700 },
      });

      const created = createdWindows.at(-1);
      expect(created?.options).toMatchObject({ x: 100, y: 100 });
    });

    it("drops the saved x/y when it no longer intersects any connected display", () => {
      // Regression test: a window last positioned on a second monitor that's since
      // been unplugged/reconfigured used to be constructed at that stale, now
      // off-screen position verbatim — appearing completely unreachable to the user.
      // The saved position (2000,100) was on a second monitor to the right of the
      // primary display; only the primary display (0,0 1920x1080) is connected now.
      // getDisplayMatching's real behavior returns its closest guess (the primary
      // display here) even though the saved rect doesn't actually overlap it.
      createMainWindow({
        playbackSource: undefined,
        initialBounds: { x: 2000, y: 100, width: 900, height: 700 },
      });

      const created = createdWindows.at(-1);
      expect(created?.options.x).toBeUndefined();
      expect(created?.options.y).toBeUndefined();
      // Width/height are still honored — only the position was untrustworthy.
      expect(created?.options).toMatchObject({ width: 900, height: 700 });
    });
  });

  describe("default landscape window size", () => {
    it("uses the flat default size on a large-enough display", () => {
      createMainWindow({ playbackSource: undefined, initialAspectRatio: 0 });

      const created = createdWindows.at(-1);
      expect(created?.options).toMatchObject({ width: 1100, height: 720 });
    });

    it("clamps the default size to a smaller display's work area", () => {
      // Regression test: only the portrait-ratio default size was ever clamped
      // against the target display — a landscape/square/free-ratio launch with no
      // saved bounds on a smaller screen used to construct a window wider/taller
      // than the visible screen entirely unclamped.
      ipcMainHandlers.clear();
      createdWindows.length = 0;
      primaryDisplay = fakeDisplay({ x: 0, y: 0, width: 1000, height: 700 });
      displayMatchingResult = primaryDisplay;

      createMainWindow({ playbackSource: undefined, initialAspectRatio: 0 });

      const created = createdWindows.at(-1);
      expect(created?.options.width as number).toBeLessThanOrEqual(900);
      expect(created?.options.height as number).toBeLessThanOrEqual(630);
      expect(created?.options.width as number).toBeGreaterThanOrEqual(MIN_WINDOW_WIDTH);
      expect(created?.options.height as number).toBeGreaterThanOrEqual(MIN_WINDOW_HEIGHT);
    });
  });
});

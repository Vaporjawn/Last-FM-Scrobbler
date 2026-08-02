import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  persistWindowBounds,
  type BoundsTrackedWindow,
} from "../../../src/main/window/persist-window-bounds.js";

const INITIAL_BOUNDS = { width: 1100, height: 720, x: 0, y: 0 };
const RESIZED_BOUNDS = { width: 1400, height: 900, x: 10, y: 20 };

function fakeWindow(initialBounds = INITIAL_BOUNDS): BoundsTrackedWindow & {
  emitResize: () => void;
  emitMove: () => void;
  setBounds: (bounds: typeof INITIAL_BOUNDS) => void;
  markDestroyed: () => void;
} {
  let currentBounds = initialBounds;
  let destroyed = false;
  const resizeListeners: (() => void)[] = [];
  const moveListeners: (() => void)[] = [];

  return {
    onResize: (listener) => {
      resizeListeners.push(listener);
    },
    onMove: (listener) => {
      moveListeners.push(listener);
    },
    getBounds: () => currentBounds,
    isDestroyed: () => destroyed,
    emitResize: () => {
      for (const listener of resizeListeners) listener();
    },
    emitMove: () => {
      for (const listener of moveListeners) listener();
    },
    setBounds: (bounds) => {
      currentBounds = bounds;
    },
    markDestroyed: () => {
      destroyed = true;
    },
  };
}

function fakeSettingsStore() {
  return { set: vi.fn() };
}

describe("persistWindowBounds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves the window's bounds after a resize, once the debounce delay elapses", () => {
    const window = fakeWindow();
    window.setBounds(RESIZED_BOUNDS);
    const settingsStore = fakeSettingsStore();
    persistWindowBounds({ window, settingsStore, debounceMs: 500 });

    window.emitResize();
    expect(settingsStore.set).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);

    expect(settingsStore.set).toHaveBeenCalledWith({ windowBounds: RESIZED_BOUNDS });
  });

  it("saves the window's bounds after a move too", () => {
    const window = fakeWindow();
    window.setBounds(RESIZED_BOUNDS);
    const settingsStore = fakeSettingsStore();
    persistWindowBounds({ window, settingsStore, debounceMs: 500 });

    window.emitMove();
    vi.advanceTimersByTime(500);

    expect(settingsStore.set).toHaveBeenCalledWith({ windowBounds: RESIZED_BOUNDS });
  });

  it("debounces rapid resize events into a single save", () => {
    const window = fakeWindow();
    const settingsStore = fakeSettingsStore();
    persistWindowBounds({ window, settingsStore, debounceMs: 500 });

    window.emitResize();
    vi.advanceTimersByTime(200);
    window.emitResize();
    vi.advanceTimersByTime(200);
    window.emitResize();
    vi.advanceTimersByTime(500);

    expect(settingsStore.set).toHaveBeenCalledOnce();
  });

  it("does not save if the window was destroyed before the debounce delay elapsed", () => {
    const window = fakeWindow();
    const settingsStore = fakeSettingsStore();
    persistWindowBounds({ window, settingsStore, debounceMs: 500 });

    window.emitResize();
    window.markDestroyed();
    vi.advanceTimersByTime(500);

    expect(settingsStore.set).not.toHaveBeenCalled();
  });

  it("cancels a pending save when the returned cleanup function is called", () => {
    const window = fakeWindow();
    const settingsStore = fakeSettingsStore();
    const stop = persistWindowBounds({ window, settingsStore, debounceMs: 500 });

    window.emitResize();
    stop();
    vi.advanceTimersByTime(500);

    expect(settingsStore.set).not.toHaveBeenCalled();
  });

  it("defaults to a 500ms debounce when none is specified", () => {
    const window = fakeWindow();
    const settingsStore = fakeSettingsStore();
    persistWindowBounds({ window, settingsStore });

    window.emitResize();
    vi.advanceTimersByTime(499);
    expect(settingsStore.set).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(settingsStore.set).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  bringAppToForeground,
  type ForegroundableApp,
  type ForegroundableWindow,
} from "../../../src/main/window/bring-app-to-foreground.js";

/**
 * These tests prove the *logic* is correct — that every documented call happens, with
 * the right arguments, in the right order, and that the minimized/dock-less edge cases
 * are handled. They cannot prove (nothing running in CI can) that a real OS actually
 * honors `app.focus({steal: true})` — that depends on live, interactive window-manager
 * behavior outside any test framework's control. See the function's own docstring.
 */
function fakeWindow(overrides: Partial<ForegroundableWindow> = {}): ForegroundableWindow {
  return {
    isMinimized: vi.fn().mockReturnValue(false),
    restore: vi.fn(),
    show: vi.fn(),
    moveTop: vi.fn(),
    focus: vi.fn(),
    flashFrame: vi.fn(),
    ...overrides,
  };
}

function fakeApp(overrides: Partial<ForegroundableApp> = {}): ForegroundableApp {
  return {
    focus: vi.fn(),
    dock: { bounce: vi.fn().mockReturnValue(0) },
    ...overrides,
  };
}

describe("bringAppToForeground", () => {
  it("calls app.focus({steal: true}) before window.show() — not after", () => {
    const app = fakeApp();
    const window = fakeWindow();
    const callOrder: string[] = [];
    (app.focus as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callOrder.push("app.focus");
    });
    (window.show as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callOrder.push("window.show");
    });

    bringAppToForeground(app, window);

    expect(callOrder).toEqual(["app.focus", "window.show"]);
  });

  it("calls app.focus with {steal: true}", () => {
    const app = fakeApp();
    const window = fakeWindow();

    bringAppToForeground(app, window);

    expect(app.focus).toHaveBeenCalledWith({ steal: true });
  });

  it("restores the window when minimized", () => {
    const app = fakeApp();
    const window = fakeWindow({ isMinimized: vi.fn().mockReturnValue(true) });

    bringAppToForeground(app, window);

    expect(window.restore).toHaveBeenCalledOnce();
  });

  it("does not restore the window when it isn't minimized", () => {
    const app = fakeApp();
    const window = fakeWindow({ isMinimized: vi.fn().mockReturnValue(false) });

    bringAppToForeground(app, window);

    expect(window.restore).not.toHaveBeenCalled();
  });

  it("shows, raises, and focuses the window", () => {
    const app = fakeApp();
    const window = fakeWindow();

    bringAppToForeground(app, window);

    expect(window.show).toHaveBeenCalledOnce();
    expect(window.moveTop).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
  });

  it("bounces the dock with a 'critical' bounce when a dock is present (macOS)", () => {
    const app = fakeApp();
    const window = fakeWindow();

    bringAppToForeground(app, window);

    expect(app.dock?.bounce).toHaveBeenCalledWith("critical");
  });

  it("doesn't throw when there's no dock (every platform except macOS)", () => {
    const app = fakeApp({ dock: undefined });
    const window = fakeWindow();

    expect(() => {
      bringAppToForeground(app, window);
    }).not.toThrow();
  });

  it("doesn't throw when dock is explicitly null", () => {
    const app = fakeApp({ dock: null });
    const window = fakeWindow();

    expect(() => {
      bringAppToForeground(app, window);
    }).not.toThrow();
  });

  it("flashes the taskbar frame (Windows/Linux fallback)", () => {
    const app = fakeApp();
    const window = fakeWindow();

    bringAppToForeground(app, window);

    expect(window.flashFrame).toHaveBeenCalledWith(true);
  });

  it("calls every step exactly once for a single invocation", () => {
    const app = fakeApp();
    const window = fakeWindow();

    bringAppToForeground(app, window);

    expect(app.focus).toHaveBeenCalledOnce();
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.moveTop).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
    expect(window.flashFrame).toHaveBeenCalledOnce();
  });
});

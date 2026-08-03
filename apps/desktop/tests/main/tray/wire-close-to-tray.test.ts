import { describe, expect, it, vi } from "vitest";
import { wireCloseToTray, type CloseToTrayWindow } from "../../../src/main/tray/wire-close-to-tray.js";

function fakeWindow(): CloseToTrayWindow & { emitClose: (event: { preventDefault: () => void }) => void } {
  let closeListener: ((event: { preventDefault: () => void }) => void) | undefined;
  return {
    // The real `on` signature only ever accepts "close" here (see `CloseToTrayWindow`),
    // so there's nothing else to branch on — just record the listener.
    on: (_event, listener) => {
      closeListener = listener;
    },
    hide: vi.fn(),
    emitClose(event) {
      closeListener?.(event);
    },
  };
}

function fakeSettingsStore(closeToTray: boolean) {
  return {
    get: () => ({
      closeToTray,
      autoUpdateEnabled: true,
      hasShownTrayHint: false,
      aspectRatio: "free" as const,
      themeMode: "dark" as const,
      notifyOnScrobble: true,
      notifyOnScrobbleFailure: true,
      launchAtLogin: false,
      startMinimized: false,
      showDockIcon: true,
      showTrayIcon: true,
    }),
  };
}

describe("wireCloseToTray", () => {
  it("hides the window and prevents the default close when closeToTray is enabled", () => {
    const window = fakeWindow();
    const preventDefault = vi.fn();
    wireCloseToTray({ window, settingsStore: fakeSettingsStore(true), isQuitting: () => false });

    window.emitClose({ preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(window.hide).toHaveBeenCalledOnce();
  });

  it("lets the window close normally when closeToTray is disabled", () => {
    const window = fakeWindow();
    const preventDefault = vi.fn();
    wireCloseToTray({ window, settingsStore: fakeSettingsStore(false), isQuitting: () => false });

    window.emitClose({ preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(window.hide).not.toHaveBeenCalled();
  });

  it("lets the window close normally when the app is actually quitting, even if closeToTray is enabled", () => {
    const window = fakeWindow();
    const preventDefault = vi.fn();
    wireCloseToTray({ window, settingsStore: fakeSettingsStore(true), isQuitting: () => true });

    window.emitClose({ preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(window.hide).not.toHaveBeenCalled();
  });

  it("calls onHide every time the window is actually hidden-to-tray", () => {
    const window = fakeWindow();
    const onHide = vi.fn();
    wireCloseToTray({ window, settingsStore: fakeSettingsStore(true), isQuitting: () => false, onHide });

    window.emitClose({ preventDefault: vi.fn() });
    window.emitClose({ preventDefault: vi.fn() });

    expect(onHide).toHaveBeenCalledTimes(2);
  });

  it("does not call onHide when the app is actually quitting", () => {
    const window = fakeWindow();
    const onHide = vi.fn();
    wireCloseToTray({ window, settingsStore: fakeSettingsStore(true), isQuitting: () => true, onHide });

    window.emitClose({ preventDefault: vi.fn() });

    expect(onHide).not.toHaveBeenCalled();
  });

  it("doesn't throw when onHide is omitted", () => {
    const window = fakeWindow();
    wireCloseToTray({ window, settingsStore: fakeSettingsStore(true), isQuitting: () => false });

    expect(() => {
      window.emitClose({ preventDefault: vi.fn() });
    }).not.toThrow();
  });
});

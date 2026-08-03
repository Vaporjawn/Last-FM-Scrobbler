import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ipcMainHandlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
const ipcMain = {
  handle: vi.fn((channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
    ipcMainHandlers.set(channel, handler);
  }),
  removeHandler: vi.fn((channel: string) => {
    ipcMainHandlers.delete(channel);
  }),
};

vi.mock("electron", () => ({ ipcMain, default: { ipcMain } }));

const { wireUpdates } = await import("../../../src/main/updates/wire-updates.js");
const { IPC_CHANNELS } = await import("../../../src/shared/ipc-channels.js");

type Listener = (...args: unknown[]) => void;

/** A minimal fake matching `UpdaterClient` — a real, self-contained event emitter
 * rather than a mock of Node's `EventEmitter` class, so tests can fire events with
 * plain, readable calls (`fakeClient.emit("update-available", { version: "1.2.3" })`). */
function fakeUpdaterClient() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    autoDownload: true,
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    quitAndInstall: vi.fn(),
    on: vi.fn((event: string, listener: Listener) => {
      const set = listeners.get(event) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(event, set);
    }),
    off: vi.fn((event: string, listener: Listener) => {
      listeners.get(event)?.delete(listener);
    }),
    emit(event: string, ...args: unknown[]) {
      for (const listener of listeners.get(event) ?? []) {
        listener(...args);
      }
    },
  };
}

function fakeMainWindow() {
  return {
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: { send: vi.fn() },
  };
}

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = ipcMainHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return Promise.resolve(handler({}, ...args));
}

describe("wireUpdates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("getStatus starts at idle before any check has run", async () => {
    const client = fakeUpdaterClient();
    wireUpdates({
      client,
      getMainWindow: () => fakeMainWindow() as never,
      isAutoCheckEnabled: () => false,
      promptToRestart: vi.fn(),
    });

    await expect(invoke(IPC_CHANNELS.updatesGetStatus)).resolves.toEqual({ phase: "idle" });
  });

  it("pushes status changes to the renderer as the client emits events", () => {
    const client = fakeUpdaterClient();
    const mainWindow = fakeMainWindow();
    wireUpdates({
      client,
      getMainWindow: () => mainWindow as never,
      isAutoCheckEnabled: () => false,
      promptToRestart: vi.fn(),
    });

    client.emit("checking-for-update");
    client.emit("update-available", { version: "1.2.3" });
    client.emit("download-progress", { percent: 42 });

    expect(mainWindow.webContents.send).toHaveBeenNthCalledWith(
      1,
      IPC_CHANNELS.updatesStatusChanged,
      { phase: "checking" },
    );
    expect(mainWindow.webContents.send).toHaveBeenNthCalledWith(
      2,
      IPC_CHANNELS.updatesStatusChanged,
      { phase: "available", version: "1.2.3" },
    );
    expect(mainWindow.webContents.send).toHaveBeenNthCalledWith(
      3,
      IPC_CHANNELS.updatesStatusChanged,
      { phase: "downloading", percent: 42 },
    );
  });

  it("pushes status to the replacement window after the main window is recreated", () => {
    // Regression test: `getMainWindow` used to be a plain captured `mainWindow`
    // value, not a live accessor — after the main window was closed and recreated
    // (main/index.ts's `app.on("activate")` reassigning its own `mainWindow`
    // variable), status pushes silently kept targeting the original, now-destroyed
    // window forever, since its own `isDestroyed()` guard permanently short-circuited
    // every future send.
    const client = fakeUpdaterClient();
    let currentWindow = fakeMainWindow();
    wireUpdates({
      client,
      getMainWindow: () => currentWindow as never,
      isAutoCheckEnabled: () => false,
      promptToRestart: vi.fn(),
    });

    client.emit("checking-for-update");
    expect(currentWindow.webContents.send).toHaveBeenCalledTimes(1);

    // The window is closed and replaced — same effect as main/index.ts reassigning
    // its own `mainWindow` variable in the `activate` handler.
    const oldWindow = currentWindow;
    oldWindow.isDestroyed.mockReturnValue(true);
    currentWindow = fakeMainWindow();

    client.emit("update-available", { version: "1.2.3" });

    expect(oldWindow.webContents.send).toHaveBeenCalledTimes(1); // unchanged, still 1
    expect(currentWindow.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.updatesStatusChanged,
      { phase: "available", version: "1.2.3" },
    );
  });

  it("doesn't push to a destroyed window", () => {
    const client = fakeUpdaterClient();
    const mainWindow = fakeMainWindow();
    mainWindow.isDestroyed.mockReturnValue(true);
    wireUpdates({
      client,
      getMainWindow: () => mainWindow as never,
      isAutoCheckEnabled: () => false,
      promptToRestart: vi.fn(),
    });

    client.emit("checking-for-update");

    expect(mainWindow.webContents.send).not.toHaveBeenCalled();
  });

  it("an 'error' event updates status with the error's message", async () => {
    const client = fakeUpdaterClient();
    wireUpdates({
      client,
      getMainWindow: () => fakeMainWindow() as never,
      isAutoCheckEnabled: () => false,
      promptToRestart: vi.fn(),
    });

    client.emit("error", new Error("network unreachable"));

    await expect(invoke(IPC_CHANNELS.updatesGetStatus)).resolves.toEqual({
      phase: "error",
      message: "network unreachable",
    });
  });

  it("calls onUpdateCheckFailed with the error's message", () => {
    const client = fakeUpdaterClient();
    const onUpdateCheckFailed = vi.fn();
    wireUpdates({
      client,
      getMainWindow: () => fakeMainWindow() as never,
      isAutoCheckEnabled: () => false,
      promptToRestart: vi.fn(),
      onUpdateCheckFailed,
    });

    client.emit("error", new Error("network unreachable"));

    expect(onUpdateCheckFailed).toHaveBeenCalledWith("network unreachable");
  });

  it("doesn't throw when an 'error' event fires with no onUpdateCheckFailed provided", () => {
    const client = fakeUpdaterClient();
    wireUpdates({
      client,
      getMainWindow: () => fakeMainWindow() as never,
      isAutoCheckEnabled: () => false,
      promptToRestart: vi.fn(),
    });

    expect(() => {
      client.emit("error", new Error("network unreachable"));
    }).not.toThrow();
  });

  it("calls onUpdateAvailable with the version once an update is found", () => {
    const client = fakeUpdaterClient();
    const onUpdateAvailable = vi.fn();
    wireUpdates({
      client,
      getMainWindow: () => fakeMainWindow() as never,
      isAutoCheckEnabled: () => false,
      promptToRestart: vi.fn(),
      onUpdateAvailable,
    });

    client.emit("update-available", { version: "1.2.3" });

    expect(onUpdateAvailable).toHaveBeenCalledWith("1.2.3");
  });

  it("doesn't throw when 'update-available' fires with no onUpdateAvailable provided", () => {
    const client = fakeUpdaterClient();
    wireUpdates({
      client,
      getMainWindow: () => fakeMainWindow() as never,
      isAutoCheckEnabled: () => false,
      promptToRestart: vi.fn(),
    });

    expect(() => {
      client.emit("update-available", { version: "1.2.3" });
    }).not.toThrow();
  });

  it("prompts to restart when a download finishes, and installs if the user agrees", async () => {
    const client = fakeUpdaterClient();
    const promptToRestart = vi.fn().mockResolvedValue(true);
    wireUpdates({
      client,
      getMainWindow: () => fakeMainWindow() as never,
      isAutoCheckEnabled: () => false,
      promptToRestart,
    });

    client.emit("update-downloaded", { version: "1.2.3" });
    await vi.waitFor(() => {
      expect(promptToRestart).toHaveBeenCalledWith("1.2.3");
    });
    await vi.waitFor(() => {
      expect(client.quitAndInstall).toHaveBeenCalled();
    });
  });

  it("does not install if the user declines the restart prompt", async () => {
    const client = fakeUpdaterClient();
    const promptToRestart = vi.fn().mockResolvedValue(false);
    wireUpdates({
      client,
      getMainWindow: () => fakeMainWindow() as never,
      isAutoCheckEnabled: () => false,
      promptToRestart,
    });

    client.emit("update-downloaded", { version: "1.2.3" });
    await vi.waitFor(() => {
      expect(promptToRestart).toHaveBeenCalled();
    });

    expect(client.quitAndInstall).not.toHaveBeenCalled();
  });

  it("checkNow (manual) always triggers a check, even with auto-check disabled", async () => {
    const client = fakeUpdaterClient();
    wireUpdates({
      client,
      getMainWindow: () => fakeMainWindow() as never,
      isAutoCheckEnabled: () => false,
      promptToRestart: vi.fn(),
    });

    await invoke(IPC_CHANNELS.updatesCheckNow);

    expect(client.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it("runs an initial background check after the startup delay, only when auto-check is enabled", () => {
    const client = fakeUpdaterClient();
    wireUpdates({
      client,
      getMainWindow: () => fakeMainWindow() as never,
      isAutoCheckEnabled: () => true,
      promptToRestart: vi.fn(),
      initialCheckDelayMs: 10_000,
      checkIntervalMs: 4 * 60 * 60 * 1000,
    });

    vi.advanceTimersByTime(9_999);
    expect(client.checkForUpdates).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(client.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it("skips the initial and periodic background checks when auto-check is disabled", () => {
    const client = fakeUpdaterClient();
    wireUpdates({
      client,
      getMainWindow: () => fakeMainWindow() as never,
      isAutoCheckEnabled: () => false,
      promptToRestart: vi.fn(),
      initialCheckDelayMs: 10_000,
      checkIntervalMs: 60_000,
    });

    vi.advanceTimersByTime(10_000 + 60_000 * 3);

    expect(client.checkForUpdates).not.toHaveBeenCalled();
  });

  it("checks again on the configured interval", () => {
    const client = fakeUpdaterClient();
    wireUpdates({
      client,
      getMainWindow: () => fakeMainWindow() as never,
      isAutoCheckEnabled: () => true,
      promptToRestart: vi.fn(),
      initialCheckDelayMs: 1_000,
      checkIntervalMs: 5_000,
    });

    vi.advanceTimersByTime(1_000);
    expect(client.checkForUpdates).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_000);
    expect(client.checkForUpdates).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(5_000);
    expect(client.checkForUpdates).toHaveBeenCalledTimes(3);
  });

  it("removes handlers, listeners, and timers when the returned cleanup function is called", () => {
    const client = fakeUpdaterClient();
    const stop = wireUpdates({
      client,
      getMainWindow: () => fakeMainWindow() as never,
      isAutoCheckEnabled: () => true,
      promptToRestart: vi.fn(),
      initialCheckDelayMs: 1_000,
      checkIntervalMs: 5_000,
    });
    expect(ipcMainHandlers.has(IPC_CHANNELS.updatesGetStatus)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.updatesGetStatus)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.updatesCheckNow)).toBe(false);
    expect(client.off).toHaveBeenCalledWith("checking-for-update", expect.any(Function));
    expect(client.off).toHaveBeenCalledWith("error", expect.any(Function));

    // Timers cleared — advancing past both the initial delay and an interval tick
    // triggers nothing further.
    vi.advanceTimersByTime(10_000);
    expect(client.checkForUpdates).not.toHaveBeenCalled();
  });
});

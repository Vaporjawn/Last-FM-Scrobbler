import { describe, expect, it, vi } from "vitest";
import { NetworkStatusMonitor, ScrobbleQueue } from "@lastfm-scrobbler/core";

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

const { wireNetworkStatus } = await import("../../../src/main/network/wire-network-status.js");
const { IPC_CHANNELS } = await import("../../../src/shared/ipc-channels.js");

function fakeWindow(): { isDestroyed: () => boolean; webContents: { send: ReturnType<typeof vi.fn> } } {
  return { isDestroyed: () => false, webContents: { send: vi.fn() } };
}

function fakeTray(): { setToolTip: ReturnType<typeof vi.fn> } {
  return { setToolTip: vi.fn() };
}

describe("wireNetworkStatus", () => {
  it("pushes the current status to the main window on every monitor change", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const monitor = new NetworkStatusMonitor({ queue });
    const mainWindow = fakeWindow();
    const { stop } = wireNetworkStatus({
      monitor,
      getMainWindow: () => mainWindow as unknown as Electron.BrowserWindow,
      getTray: () => undefined,
    });

    monitor.reportSuccess();

    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.networkStatusChanged,
      monitor.getStatus(),
    );
    stop();
    queue.close();
  });

  it("does not push to a destroyed window", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const monitor = new NetworkStatusMonitor({ queue });
    const mainWindow = { isDestroyed: () => true, webContents: { send: vi.fn() } };
    const { stop } = wireNetworkStatus({
      monitor,
      getMainWindow: () => mainWindow as unknown as Electron.BrowserWindow,
      getTray: () => undefined,
    });

    monitor.reportSuccess();

    expect(mainWindow.webContents.send).not.toHaveBeenCalled();
    stop();
    queue.close();
  });

  it("updates the tray tooltip to reflect offline + pending count", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    queue.enqueue({ artist: "A", track: "B", timestamp: 1_700_000_000 });
    queue.enqueue({ artist: "C", track: "D", timestamp: 1_700_000_001 });
    const monitor = new NetworkStatusMonitor({ queue });
    const tray = fakeTray();
    const { stop } = wireNetworkStatus({
      monitor,
      getMainWindow: () => undefined,
      getTray: () => tray as unknown as Electron.Tray,
    });

    monitor.reportFailure(Object.assign(new Error("connect failed"), { code: "ECONNREFUSED" }));

    expect(tray.setToolTip).toHaveBeenCalledWith("Last.fm Scrobbler — Offline, 2 pending");
    stop();
    queue.close();
  });

  it("shows a plain tooltip once fully synced (online, nothing pending)", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const monitor = new NetworkStatusMonitor({ queue });
    const tray = fakeTray();
    const { stop } = wireNetworkStatus({
      monitor,
      getMainWindow: () => undefined,
      getTray: () => tray as unknown as Electron.Tray,
    });

    monitor.reportSuccess();

    expect(tray.setToolTip).toHaveBeenCalledWith("Last.fm Scrobbler");
    stop();
    queue.close();
  });

  it("shows only the pending count while still online", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    queue.enqueue({ artist: "A", track: "B", timestamp: 1_700_000_000 });
    const monitor = new NetworkStatusMonitor({ queue });
    const tray = fakeTray();
    const { stop } = wireNetworkStatus({
      monitor,
      getMainWindow: () => undefined,
      getTray: () => tray as unknown as Electron.Tray,
    });

    monitor.reportSuccess();

    expect(tray.setToolTip).toHaveBeenCalledWith("Last.fm Scrobbler — 1 pending");
    stop();
    queue.close();
  });

  it("syncTrayTooltip re-applies the current status on demand", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const monitor = new NetworkStatusMonitor({ queue });
    monitor.reportFailure(Object.assign(new Error("x"), { code: "ECONNREFUSED" }));
    const tray = fakeTray();
    const { syncTrayTooltip, stop } = wireNetworkStatus({
      monitor,
      getMainWindow: () => undefined,
      getTray: () => tray as unknown as Electron.Tray,
    });

    syncTrayTooltip();

    expect(tray.setToolTip).toHaveBeenCalledWith("Last.fm Scrobbler — Offline");
    stop();
    queue.close();
  });

  it("stop() unsubscribes from the monitor", () => {
    const queue = new ScrobbleQueue({ databasePath: ":memory:" });
    const monitor = new NetworkStatusMonitor({ queue });
    const mainWindow = fakeWindow();
    const { stop } = wireNetworkStatus({
      monitor,
      getMainWindow: () => mainWindow as unknown as Electron.BrowserWindow,
      getTray: () => undefined,
    });

    stop();
    monitor.reportSuccess();

    expect(mainWindow.webContents.send).not.toHaveBeenCalled();
    queue.close();
  });
});

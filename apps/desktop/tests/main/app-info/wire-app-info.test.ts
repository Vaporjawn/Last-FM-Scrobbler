import { describe, expect, it, vi } from "vitest";

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

const { wireAppInfo } = await import("../../../src/main/app-info/wire-app-info.js");
const { IPC_CHANNELS } = await import("../../../src/shared/ipc-channels.js");

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = ipcMainHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return Promise.resolve(handler({}, ...args));
}

describe("wireAppInfo", () => {
  it("getVersion returns the value from the injected getVersion() function", async () => {
    wireAppInfo({ getVersion: () => "1.2.3" });

    await expect(invoke(IPC_CHANNELS.appGetVersion)).resolves.toBe("1.2.3");
  });

  it("removes the handler when the returned cleanup function is called", () => {
    const stop = wireAppInfo({ getVersion: () => "1.2.3" });
    expect(ipcMainHandlers.has(IPC_CHANNELS.appGetVersion)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.appGetVersion)).toBe(false);
  });
});

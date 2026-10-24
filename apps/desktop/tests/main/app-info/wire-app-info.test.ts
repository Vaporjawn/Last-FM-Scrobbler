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

const EXPECTED_ORIGIN = "http://localhost:5173";
const TRUSTED_EVENT = { senderFrame: { url: "http://localhost:5173/" } };

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = ipcMainHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return Promise.resolve(handler(TRUSTED_EVENT, ...args));
}

describe("wireAppInfo", () => {
  it("getVersion returns the value from the injected getVersion() function", async () => {
    wireAppInfo({ expectedOrigin: EXPECTED_ORIGIN, getVersion: () => "1.2.3" });

    await expect(invoke(IPC_CHANNELS.appGetVersion)).resolves.toBe("1.2.3");
  });

  it("removes the handler when the returned cleanup function is called", () => {
    const stop = wireAppInfo({ expectedOrigin: EXPECTED_ORIGIN, getVersion: () => "1.2.3" });
    expect(ipcMainHandlers.has(IPC_CHANNELS.appGetVersion)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.appGetVersion)).toBe(false);
  });

  it("showMainWindow calls the injected onShowMainWindow callback", async () => {
    const onShowMainWindow = vi.fn();
    wireAppInfo({ expectedOrigin: EXPECTED_ORIGIN, getVersion: () => "1.2.3", onShowMainWindow });

    await invoke(IPC_CHANNELS.appShowMainWindow);

    expect(onShowMainWindow).toHaveBeenCalledOnce();
  });

  it("showMainWindow doesn't throw when no onShowMainWindow callback was given", async () => {
    wireAppInfo({ expectedOrigin: EXPECTED_ORIGIN, getVersion: () => "1.2.3" });

    await expect(invoke(IPC_CHANNELS.appShowMainWindow)).resolves.toBeUndefined();
  });

  it("removes both handlers when the returned cleanup function is called", () => {
    const stop = wireAppInfo({ expectedOrigin: EXPECTED_ORIGIN, getVersion: () => "1.2.3" });
    expect(ipcMainHandlers.has(IPC_CHANNELS.appShowMainWindow)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.appShowMainWindow)).toBe(false);
  });

  it("rejects every handler it registers when the caller is not the app's own page", () => {
    wireAppInfo({ expectedOrigin: EXPECTED_ORIGIN, getVersion: () => "1.2.3" });
    expect(ipcMainHandlers.size).toBeGreaterThan(0);
    for (const [channel, handler] of ipcMainHandlers) {
      expect(() => handler({ senderFrame: { url: "https://evil.example/" } }), channel).toThrow(
        /untrusted sender/i,
      );
    }
  });
});

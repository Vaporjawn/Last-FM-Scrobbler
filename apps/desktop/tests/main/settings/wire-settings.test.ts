import { describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../../src/shared/settings-api.js";

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

const { wireSettings } = await import("../../../src/main/settings/wire-settings.js");
const { IPC_CHANNELS } = await import("../../../src/shared/ipc-channels.js");

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = ipcMainHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return Promise.resolve(handler({}, ...args));
}

const DEFAULT_SETTINGS: AppSettings = {
  closeToTray: true,
  autoUpdateEnabled: true,
  hasShownTrayHint: false,
  aspectRatio: "free",
  themeMode: "dark",
};

function fakeStore(initial = DEFAULT_SETTINGS) {
  let settings = { ...initial };
  return {
    get: vi.fn(() => settings),
    set: vi.fn((patch: Partial<typeof initial>) => {
      settings = { ...settings, ...patch };
      return settings;
    }),
  };
}

describe("wireSettings", () => {
  it("get returns the store's current settings", async () => {
    const store = fakeStore(DEFAULT_SETTINGS);
    wireSettings({ store });

    await expect(invoke(IPC_CHANNELS.settingsGet)).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("set forwards the patch to the store and returns the updated settings", async () => {
    const store = fakeStore(DEFAULT_SETTINGS);
    wireSettings({ store });

    const result = await invoke(IPC_CHANNELS.settingsSet, { closeToTray: false });

    expect(result).toEqual({ ...DEFAULT_SETTINGS, closeToTray: false });
    expect(store.set).toHaveBeenCalledWith({ closeToTray: false });
  });

  it("calls onAspectRatioChange with the new value when a set() patch changes aspectRatio", async () => {
    const store = fakeStore(DEFAULT_SETTINGS);
    const onAspectRatioChange = vi.fn();
    wireSettings({ store, onAspectRatioChange });

    await invoke(IPC_CHANNELS.settingsSet, { aspectRatio: "16:9" });

    expect(onAspectRatioChange).toHaveBeenCalledWith("16:9");
  });

  it("does not call onAspectRatioChange when a set() patch doesn't touch aspectRatio", async () => {
    const store = fakeStore(DEFAULT_SETTINGS);
    const onAspectRatioChange = vi.fn();
    wireSettings({ store, onAspectRatioChange });

    await invoke(IPC_CHANNELS.settingsSet, { closeToTray: false });

    expect(onAspectRatioChange).not.toHaveBeenCalled();
  });

  it("doesn't throw when onAspectRatioChange is omitted and a patch changes aspectRatio", async () => {
    const store = fakeStore(DEFAULT_SETTINGS);
    wireSettings({ store });

    const result = await invoke(IPC_CHANNELS.settingsSet, { aspectRatio: "4:3" });

    expect(result).toMatchObject({ aspectRatio: "4:3" });
  });

  it("removes all handlers when the returned cleanup function is called", () => {
    const stop = wireSettings({ store: fakeStore() });
    expect(ipcMainHandlers.has(IPC_CHANNELS.settingsGet)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.settingsGet)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.settingsSet)).toBe(false);
  });
});

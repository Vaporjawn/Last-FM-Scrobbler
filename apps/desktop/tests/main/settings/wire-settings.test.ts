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
  aspectRatio: "9:16",
  themeMode: "dark",
  notifyOnScrobble: true,
  notifyOnScrobbleFailure: true,
  launchAtLogin: false,
  startMinimized: false,
  showDockIcon: true,
  showTrayIcon: true,
};

function fakeStore(initial = DEFAULT_SETTINGS) {
  let settings = { ...initial };
  return {
    get: vi.fn(() => settings),
    set: vi.fn((patch: Partial<typeof initial>) => {
      settings = { ...settings, ...patch };
      return settings;
    }),
    reset: vi.fn(() => {
      settings = { ...DEFAULT_SETTINGS };
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

  it("calls onLaunchAtLoginChange with the new value when a set() patch changes launchAtLogin", async () => {
    const store = fakeStore(DEFAULT_SETTINGS);
    const onLaunchAtLoginChange = vi.fn();
    wireSettings({ store, onLaunchAtLoginChange });

    await invoke(IPC_CHANNELS.settingsSet, { launchAtLogin: true });

    expect(onLaunchAtLoginChange).toHaveBeenCalledWith(true);
  });

  it("does not call onLaunchAtLoginChange when a set() patch changes only startMinimized", async () => {
    // startMinimized has no live effect — it only matters at the next login-triggered
    // launch (main/create-main-window.ts's startHidden option), so there's nothing to
    // apply immediately the way launchAtLogin's OS login-item registration needs.
    const store = fakeStore({ ...DEFAULT_SETTINGS, launchAtLogin: true });
    const onLaunchAtLoginChange = vi.fn();
    wireSettings({ store, onLaunchAtLoginChange });

    await invoke(IPC_CHANNELS.settingsSet, { startMinimized: true });

    expect(onLaunchAtLoginChange).not.toHaveBeenCalled();
  });

  it("does not call onLaunchAtLoginChange when a set() patch touches neither launchAtLogin nor startMinimized", async () => {
    const store = fakeStore(DEFAULT_SETTINGS);
    const onLaunchAtLoginChange = vi.fn();
    wireSettings({ store, onLaunchAtLoginChange });

    await invoke(IPC_CHANNELS.settingsSet, { closeToTray: false });

    expect(onLaunchAtLoginChange).not.toHaveBeenCalled();
  });

  it("doesn't throw when onLaunchAtLoginChange is omitted and a patch changes launchAtLogin", async () => {
    const store = fakeStore(DEFAULT_SETTINGS);
    wireSettings({ store });

    const result = await invoke(IPC_CHANNELS.settingsSet, { launchAtLogin: true });

    expect(result).toMatchObject({ launchAtLogin: true });
  });

  it("calls onShowDockIconChange with the new value when a set() patch changes showDockIcon", async () => {
    const store = fakeStore(DEFAULT_SETTINGS);
    const onShowDockIconChange = vi.fn();
    wireSettings({ store, onShowDockIconChange });

    await invoke(IPC_CHANNELS.settingsSet, { showDockIcon: false });

    expect(onShowDockIconChange).toHaveBeenCalledWith(false);
  });

  it("does not call onShowDockIconChange when a set() patch doesn't touch showDockIcon", async () => {
    const store = fakeStore(DEFAULT_SETTINGS);
    const onShowDockIconChange = vi.fn();
    wireSettings({ store, onShowDockIconChange });

    await invoke(IPC_CHANNELS.settingsSet, { closeToTray: false });

    expect(onShowDockIconChange).not.toHaveBeenCalled();
  });

  it("doesn't throw when onShowDockIconChange is omitted and a patch changes showDockIcon", async () => {
    const store = fakeStore(DEFAULT_SETTINGS);
    wireSettings({ store });

    const result = await invoke(IPC_CHANNELS.settingsSet, { showDockIcon: false });

    expect(result).toMatchObject({ showDockIcon: false });
  });

  it("reset calls the store's reset() and returns the defaults", async () => {
    const store = fakeStore({ ...DEFAULT_SETTINGS, closeToTray: false });
    wireSettings({ store });

    const result = await invoke(IPC_CHANNELS.settingsReset);

    expect(store.reset).toHaveBeenCalledOnce();
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it("reset persists — a subsequent get reflects the defaults, not the pre-reset settings", async () => {
    const store = fakeStore({ ...DEFAULT_SETTINGS, closeToTray: false, themeMode: "light" });
    wireSettings({ store });

    await invoke(IPC_CHANNELS.settingsReset);

    await expect(invoke(IPC_CHANNELS.settingsGet)).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("reset fires onAspectRatioChange, onLaunchAtLoginChange, and onShowDockIconChange with the reset values", async () => {
    const store = fakeStore({
      ...DEFAULT_SETTINGS,
      aspectRatio: "16:9",
      launchAtLogin: true,
      showDockIcon: false,
    });
    const onAspectRatioChange = vi.fn();
    const onLaunchAtLoginChange = vi.fn();
    const onShowDockIconChange = vi.fn();
    wireSettings({ store, onAspectRatioChange, onLaunchAtLoginChange, onShowDockIconChange });

    await invoke(IPC_CHANNELS.settingsReset);

    expect(onAspectRatioChange).toHaveBeenCalledWith("9:16");
    expect(onLaunchAtLoginChange).toHaveBeenCalledWith(false);
    expect(onShowDockIconChange).toHaveBeenCalledWith(true);
  });

  it("doesn't throw when reset is invoked with both live-update callbacks omitted", async () => {
    const store = fakeStore();
    wireSettings({ store });

    await expect(invoke(IPC_CHANNELS.settingsReset)).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("removes all handlers when the returned cleanup function is called", () => {
    const stop = wireSettings({ store: fakeStore() });
    expect(ipcMainHandlers.has(IPC_CHANNELS.settingsGet)).toBe(true);
    expect(ipcMainHandlers.has(IPC_CHANNELS.settingsReset)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.settingsGet)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.settingsSet)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.settingsReset)).toBe(false);
  });
});

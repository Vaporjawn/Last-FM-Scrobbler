import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlatformPlaybackSource } from "../../../src/main/playback/create-platform-playback-source.js";

const macosSource = { label: "macos" };
const linuxSource = { label: "linux" };
const windowsSource = { label: "windows" };

const createMacosPlaybackSource = vi.fn(() => macosSource as unknown);
const createLinuxPlaybackSource = vi.fn(() => linuxSource as unknown);
const createWindowsPlaybackSource = vi.fn(() => windowsSource as unknown);

vi.mock("@lastfm-scrobbler/adapter-macos", () => ({
  createMacosPlaybackSource: () => createMacosPlaybackSource(),
}));
vi.mock("@lastfm-scrobbler/adapter-linux", () => ({
  createLinuxPlaybackSource: () => createLinuxPlaybackSource(),
}));
vi.mock("@lastfm-scrobbler/adapter-windows", () => ({
  createWindowsPlaybackSource: () => createWindowsPlaybackSource(),
}));

function withPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
}

describe("createPlatformPlaybackSource", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    withPlatform(originalPlatform);
    vi.clearAllMocks();
    createMacosPlaybackSource.mockImplementation(() => macosSource);
  });

  it("uses the macOS adapter on darwin", () => {
    withPlatform("darwin");

    expect(createPlatformPlaybackSource()).toBe(macosSource);
    expect(createMacosPlaybackSource).toHaveBeenCalledOnce();
  });

  it("uses the Linux adapter on linux", () => {
    withPlatform("linux");

    expect(createPlatformPlaybackSource()).toBe(linuxSource);
  });

  it("uses the Windows adapter on win32", () => {
    withPlatform("win32");

    expect(createPlatformPlaybackSource()).toBe(windowsSource);
  });

  it("returns undefined instead of throwing for an unsupported platform", () => {
    withPlatform("freebsd");

    expect(createPlatformPlaybackSource()).toBeUndefined();
  });

  it("returns undefined instead of throwing when adapter construction fails", () => {
    withPlatform("darwin");
    createMacosPlaybackSource.mockImplementation(() => {
      throw new Error("MediaRemoteAdapter.framework not found");
    });

    expect(createPlatformPlaybackSource()).toBeUndefined();
  });
});

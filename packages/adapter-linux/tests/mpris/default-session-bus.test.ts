import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

const sessionBusMock = vi.hoisted(() => vi.fn());

vi.mock("dbus-next", () => ({ sessionBus: sessionBusMock }));

import { createLinuxPlaybackSource } from "../../src/mpris/create-linux-playback-source.js";

describe("createLinuxPlaybackSource default bus", () => {
  it("connects to dbus-next's real session bus when none is injected", async () => {
    const bus = Object.assign(new EventEmitter(), {
      getProxyObject: vi.fn(() => Promise.reject(new Error("no bus in this test"))),
      disconnect: vi.fn(),
    });
    sessionBusMock.mockReturnValue(bus);
    const onError = vi.fn();

    const source = createLinuxPlaybackSource({ onError });
    const unsubscribe = source.onPlaybackStateChanged(() => undefined);
    await new Promise((resolve) => setImmediate(resolve));
    unsubscribe();

    expect(sessionBusMock).toHaveBeenCalledTimes(1);
    expect(bus.disconnect).toHaveBeenCalled();
  });
});

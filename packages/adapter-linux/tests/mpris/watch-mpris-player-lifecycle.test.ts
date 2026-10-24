import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { MessageBus } from "dbus-next";
import { watchMprisPlayerLifecycle } from "../../src/mpris/watch-mpris-player-lifecycle.js";

function createBus() {
  const iface = new EventEmitter();
  const bus = {
    getProxyObject: vi.fn(() => Promise.resolve({ getInterface: () => iface })),
  } as unknown as MessageBus;
  return { bus, iface };
}

describe("watchMprisPlayerLifecycle", () => {
  it("reports a player appearing and disappearing", async () => {
    const { bus, iface } = createBus();
    const onChange = vi.fn();
    await watchMprisPlayerLifecycle(bus, onChange);

    iface.emit("NameOwnerChanged", "org.mpris.MediaPlayer2.vlc", "", ":1.5");
    iface.emit("NameOwnerChanged", "org.mpris.MediaPlayer2.vlc", ":1.5", "");

    expect(onChange.mock.calls).toEqual([
      [{ busName: "org.mpris.MediaPlayer2.vlc", appeared: true }],
      [{ busName: "org.mpris.MediaPlayer2.vlc", appeared: false }],
    ]);
  });

  it("ignores bus names that are not MPRIS players", async () => {
    const { bus, iface } = createBus();
    const onChange = vi.fn();
    await watchMprisPlayerLifecycle(bus, onChange);

    iface.emit("NameOwnerChanged", "org.example.Other", "", ":1.9");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores a change where the name had no owner before and has none now", async () => {
    const { bus, iface } = createBus();
    const onChange = vi.fn();
    await watchMprisPlayerLifecycle(bus, onChange);

    iface.emit("NameOwnerChanged", "org.mpris.MediaPlayer2.vlc", "", "");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("stops reporting once the returned unsubscribe is called", async () => {
    const { bus, iface } = createBus();
    const onChange = vi.fn();
    const unsubscribe = await watchMprisPlayerLifecycle(bus, onChange);

    unsubscribe();
    iface.emit("NameOwnerChanged", "org.mpris.MediaPlayer2.vlc", "", ":1.5");

    expect(onChange).not.toHaveBeenCalled();
  });
});

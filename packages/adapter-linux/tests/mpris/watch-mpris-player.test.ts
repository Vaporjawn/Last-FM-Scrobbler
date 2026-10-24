import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { MessageBus } from "dbus-next";
import { watchMprisPlayer } from "../../src/mpris/watch-mpris-player.js";

const BUS_NAME = "org.mpris.MediaPlayer2.vlc";
const PLAYER_IFACE = "org.mpris.MediaPlayer2.Player";
const flush = () => new Promise((resolve) => setImmediate(resolve));

/** A fake `org.freedesktop.DBus.Properties` interface whose `GetAll` result the test controls. */
function createPlayer(initial: Record<string, unknown>) {
  let current = initial;
  const getAll = vi.fn(() => Promise.resolve(current));
  const properties = Object.assign(new EventEmitter(), { GetAll: getAll });
  const bus = {
    getProxyObject: vi.fn(() => Promise.resolve({ getInterface: () => properties })),
  } as unknown as MessageBus;
  return {
    bus,
    properties,
    getAll,
    setCurrent(next: Record<string, unknown>) {
      current = next;
    },
    signal(changed: Record<string, unknown>, invalidated: string[] = [], iface = PLAYER_IFACE) {
      properties.emit("PropertiesChanged", iface, changed, invalidated);
    },
  };
}

describe("watchMprisPlayer", () => {
  it("emits the initial state once, immediately", async () => {
    const player = createPlayer({
      Metadata: { "xesam:title": "Song" },
      PlaybackStatus: "Playing",
    });
    const onUpdate = vi.fn();

    await watchMprisPlayer(player.bus, BUS_NAME, onUpdate);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      { title: "Song", artist: "", sourceApp: "vlc", isStream: false },
      "playing",
    );
  });

  it("treats a missing or malformed Metadata/PlaybackStatus as no track and stopped", async () => {
    const player = createPlayer({ Metadata: ["not", "a", "dict"], PlaybackStatus: 42 });
    const onUpdate = vi.fn();

    await watchMprisPlayer(player.bus, BUS_NAME, onUpdate);

    expect(onUpdate).toHaveBeenCalledWith(null, "stopped");
  });

  it("treats a null Metadata value as no track", async () => {
    const player = createPlayer({ Metadata: null, PlaybackStatus: "Paused" });
    const onUpdate = vi.fn();

    await watchMprisPlayer(player.bus, BUS_NAME, onUpdate);

    expect(onUpdate).toHaveBeenCalledWith(null, "paused");
  });

  it("emits when only the playback status changes inline", async () => {
    const player = createPlayer({
      Metadata: { "xesam:title": "Song" },
      PlaybackStatus: "Playing",
    });
    const onUpdate = vi.fn();
    await watchMprisPlayer(player.bus, BUS_NAME, onUpdate);

    player.signal({ PlaybackStatus: "Paused" });

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith(
      { title: "Song", artist: "", sourceApp: "vlc", isStream: false },
      "paused",
    );
  });

  it("ignores PropertiesChanged for other interfaces", async () => {
    const player = createPlayer({ Metadata: { "xesam:title": "Song" }, PlaybackStatus: "Playing" });
    const onUpdate = vi.fn();
    await watchMprisPlayer(player.bus, BUS_NAME, onUpdate);

    player.signal({ Volume: 1 }, [], "org.mpris.MediaPlayer2");

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not emit when neither a relevant field changed nor was invalidated", async () => {
    const player = createPlayer({ Metadata: { "xesam:title": "Song" }, PlaybackStatus: "Playing" });
    const onUpdate = vi.fn();
    await watchMprisPlayer(player.bus, BUS_NAME, onUpdate);

    player.signal({ Volume: 0.5 }, ["Position"]);
    await flush();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(player.getAll).toHaveBeenCalledTimes(1);
  });

  it("re-fetches only the playback status when just PlaybackStatus is invalidated", async () => {
    const player = createPlayer({ Metadata: { "xesam:title": "Song" }, PlaybackStatus: "Playing" });
    const onUpdate = vi.fn();
    await watchMprisPlayer(player.bus, BUS_NAME, onUpdate);

    player.setCurrent({ Metadata: { "xesam:title": "Ignored" }, PlaybackStatus: "Paused" });
    player.signal({}, ["PlaybackStatus"]);
    await flush();

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith(
      { title: "Song", artist: "", sourceApp: "vlc", isStream: false },
      "paused",
    );
  });

  it("re-fetches both fields when both are invalidated", async () => {
    const player = createPlayer({ Metadata: { "xesam:title": "Song" }, PlaybackStatus: "Playing" });
    const onUpdate = vi.fn();
    await watchMprisPlayer(player.bus, BUS_NAME, onUpdate);

    player.setCurrent({ Metadata: { "xesam:title": "Next" }, PlaybackStatus: "Paused" });
    player.signal({}, ["Metadata", "PlaybackStatus"]);
    await flush();

    expect(onUpdate).toHaveBeenLastCalledWith(
      { title: "Next", artist: "", sourceApp: "vlc", isStream: false },
      "paused",
    );
  });

  it("tolerates the player vanishing between an invalidation signal and the re-fetch", async () => {
    const player = createPlayer({ Metadata: { "xesam:title": "Song" }, PlaybackStatus: "Playing" });
    const onUpdate = vi.fn();
    await watchMprisPlayer(player.bus, BUS_NAME, onUpdate);

    player.getAll.mockRejectedValueOnce(new Error("name has no owner"));
    player.signal({}, ["Metadata"]);
    await flush();

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("stops listening once the returned unsubscribe is called", async () => {
    const player = createPlayer({ Metadata: { "xesam:title": "Song" }, PlaybackStatus: "Playing" });
    const onUpdate = vi.fn();
    const unsubscribe = await watchMprisPlayer(player.bus, BUS_NAME, onUpdate);

    unsubscribe();
    player.signal({ PlaybackStatus: "Paused" });

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});

import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createLinuxPlaybackSource } from "../../src/mpris/create-linux-playback-source.js";
import type { MessageBus } from "dbus-next";

/**
 * A minimal fake dbus-next `MessageBus` covering exactly the surface
 * `create-linux-playback-source.ts` calls: `org.freedesktop.DBus` (ListNames,
 * NameOwnerChanged) and, per MPRIS player bus name, `org.freedesktop.DBus.Properties`
 * (GetAll/Get, PropertiesChanged).
 */
function createFakeBus() {
  const dbusIface = new EventEmitter() as EventEmitter & {
    ListNames: () => Promise<string[]>;
  };
  let names: string[] = [];
  dbusIface.ListNames = vi.fn(() => Promise.resolve(names));

  const playerProperties = new Map<string, EventEmitter & { GetAll: () => Promise<unknown> }>();

  function propsFor(busName: string) {
    let iface = playerProperties.get(busName);
    if (!iface) {
      iface = new EventEmitter() as EventEmitter & { GetAll: () => Promise<unknown> };
      iface.GetAll = () => Promise.resolve(state.get(busName) ?? {});
      playerProperties.set(busName, iface);
    }
    return iface;
  }

  const state = new Map<string, Record<string, unknown>>();

  const disconnect = vi.fn();
  const bus = {
    getProxyObject: vi.fn((name: string, path: string) => {
      if (path === "/org/freedesktop/DBus") {
        return Promise.resolve({ getInterface: () => dbusIface });
      }
      return Promise.resolve({ getInterface: () => propsFor(name) });
    }),
    disconnect,
  } as unknown as MessageBus;

  return {
    bus,
    disconnect,
    setInitialNames(newNames: string[]) {
      names = newNames;
    },
    setPlayerState(busName: string, metadata: Record<string, unknown>, playbackStatus: string) {
      state.set(busName, { Metadata: metadata, PlaybackStatus: playbackStatus });
    },
    firePropertiesChanged(busName: string, changed: Record<string, unknown>) {
      propsFor(busName).emit("PropertiesChanged", "org.mpris.MediaPlayer2.Player", changed, []);
    },
    fireNameOwnerChanged(busName: string, oldOwner: string, newOwner: string) {
      dbusIface.emit("NameOwnerChanged", busName, oldOwner, newOwner);
    },
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("createLinuxPlaybackSource", () => {
  it("discovers an existing player and reports its initial track/state", async () => {
    const fake = createFakeBus();
    fake.setInitialNames(["org.mpris.MediaPlayer2.vlc"]);
    fake.setPlayerState(
      "org.mpris.MediaPlayer2.vlc",
      { "xesam:title": "Song", "xesam:artist": "Artist" },
      "Playing",
    );

    const source = createLinuxPlaybackSource({ sessionBus: () => fake.bus });
    const tracks: unknown[] = [];
    const states: unknown[] = [];
    source.onTrackChanged((t) => tracks.push(t));
    source.onPlaybackStateChanged((s) => states.push(s));
    await flush();

    expect(tracks).toEqual([{ title: "Song", artist: "Artist", sourceApp: "vlc", isStream: true }]);
    expect(states).toEqual(["playing"]);
  });

  it("reflects a PropertiesChanged update from the watched player", async () => {
    const fake = createFakeBus();
    fake.setInitialNames(["org.mpris.MediaPlayer2.vlc"]);
    fake.setPlayerState("org.mpris.MediaPlayer2.vlc", { "xesam:title": "Song A" }, "Playing");

    const source = createLinuxPlaybackSource({ sessionBus: () => fake.bus });
    const tracks: unknown[] = [];
    source.onTrackChanged((t) => tracks.push(t));
    await flush();

    fake.firePropertiesChanged("org.mpris.MediaPlayer2.vlc", {
      Metadata: { "xesam:title": "Song B" },
    });
    await flush();

    expect(tracks.map((t) => (t as { title: string }).title)).toEqual(["Song A", "Song B"]);
  });

  it("starts watching a player that appears after startup via NameOwnerChanged", async () => {
    const fake = createFakeBus();
    fake.setInitialNames([]);

    const source = createLinuxPlaybackSource({ sessionBus: () => fake.bus });
    const tracks: unknown[] = [];
    source.onTrackChanged((t) => tracks.push(t));
    await flush();

    fake.setPlayerState(
      "org.mpris.MediaPlayer2.spotify",
      { "xesam:title": "New Player Song" },
      "Playing",
    );
    fake.fireNameOwnerChanged("org.mpris.MediaPlayer2.spotify", "", ":1.99");
    await flush();

    expect(tracks.map((t) => (t as { title: string }).title)).toEqual(["New Player Song"]);
  });

  it("stops reporting a player's state once it disappears via NameOwnerChanged", async () => {
    const fake = createFakeBus();
    fake.setInitialNames(["org.mpris.MediaPlayer2.vlc"]);
    fake.setPlayerState("org.mpris.MediaPlayer2.vlc", { "xesam:title": "Song" }, "Playing");

    const source = createLinuxPlaybackSource({ sessionBus: () => fake.bus });
    const states: unknown[] = [];
    source.onPlaybackStateChanged((s) => states.push(s));
    await flush();

    fake.fireNameOwnerChanged("org.mpris.MediaPlayer2.vlc", ":1.50", "");
    await flush();

    expect(states).toEqual(["playing", "stopped"]);
  });

  it("prefers the most recently started of two simultaneously playing players", async () => {
    const fake = createFakeBus();
    fake.setInitialNames(["org.mpris.MediaPlayer2.vlc", "org.mpris.MediaPlayer2.spotify"]);
    fake.setPlayerState("org.mpris.MediaPlayer2.vlc", { "xesam:title": "VLC Song" }, "Playing");
    fake.setPlayerState(
      "org.mpris.MediaPlayer2.spotify",
      { "xesam:title": "Spotify Song" },
      "Paused",
    );

    // A real, controllable clock — two updates in the same test tick would otherwise
    // land in the same millisecond under the default `Date.now()`-based clock, making
    // "most recently started" comparisons nondeterministic (see PlayerRegistry).
    let now = 0;
    const source = createLinuxPlaybackSource({ sessionBus: () => fake.bus, now: () => now });
    const tracks: unknown[] = [];
    source.onTrackChanged((t) => tracks.push(t));
    now = 1;
    await flush();

    // Spotify starts playing after vlc was already playing — spotify should become active.
    now = 2;
    fake.setPlayerState(
      "org.mpris.MediaPlayer2.spotify",
      { "xesam:title": "Spotify Song" },
      "Playing",
    );
    fake.firePropertiesChanged("org.mpris.MediaPlayer2.spotify", { PlaybackStatus: "Playing" });
    await flush();

    expect((tracks.at(-1) as { title: string }).title).toBe("Spotify Song");
  });

  it("disconnects the bus once every subscriber has unsubscribed", async () => {
    const fake = createFakeBus();
    fake.setInitialNames(["org.mpris.MediaPlayer2.vlc"]);
    fake.setPlayerState("org.mpris.MediaPlayer2.vlc", { "xesam:title": "Song" }, "Playing");

    const source = createLinuxPlaybackSource({ sessionBus: () => fake.bus });
    const unsubTrack = source.onTrackChanged(() => undefined);
    const unsubState = source.onPlaybackStateChanged(() => undefined);
    await flush();

    unsubTrack();
    expect(fake.disconnect).not.toHaveBeenCalled();
    unsubState();

    expect(fake.disconnect).toHaveBeenCalled();
  });

  it("getPosition() resolves 0 before the bus has connected", async () => {
    const fake = createFakeBus();
    const source = createLinuxPlaybackSource({ sessionBus: () => fake.bus });

    await expect(source.getPosition()).resolves.toBe(0);
  });
});

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import dbus, { Variant, type MessageBus } from "dbus-next";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLinuxPlaybackSource } from "../../src/mpris/create-linux-playback-source.js";

/** `existsSync(path) && unlinkSync(path)` has a real TOCTOU race here specifically:
 * `dbus-daemon` cleans up its own socket file on exit, which can happen concurrently
 * with (and win against) this check — verified live in CI ("Error: ENOENT: no such
 * file or directory, unlink '/tmp/lastfm-scrobbler-test-bus-NNNN.sock'", thrown from
 * the `afterAll` below, right after `daemon.kill()` on the line before it). Since the
 * entire point of this call is "make sure this path doesn't exist anymore", an ENOENT
 * from a file that's already gone is exactly the outcome this was going for — not a
 * real failure to surface. */
function removeSocketIfPresent(path: string): void {
  try {
    unlinkSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

// Real integration smoke test: spawns a throwaway D-Bus session bus, registers a real
// MPRIS2 service on it via dbus-next's own service API (not a mock of dbus-next itself
// — a real second bus connection, exercising the real D-Bus wire protocol end to end),
// and points createLinuxPlaybackSource() at that same bus. No mocking of this project's
// own code. Skipped when `dbus-daemon` isn't available (e.g. a minimal CI image without
// it) rather than failing the whole suite.
const dbusDaemonAvailable = spawnSync("dbus-daemon", ["--version"]).status === 0;

describe.skipIf(!dbusDaemonAvailable)("MPRIS2 adapter (real D-Bus pipeline)", () => {
  const socketPath = join(tmpdir(), `lastfm-scrobbler-test-bus-${process.pid}.sock`);
  const busAddress = `unix:path=${socketPath}`;
  let daemon: ChildProcess;
  let mockBus: MessageBus;

  class PlayerInterface extends dbus.interface.Interface {
    playbackStatus = "Playing";
    metadata: Record<string, Variant> = {
      "xesam:title": new Variant("s", "Windowlicker"),
      "xesam:artist": new Variant("as", ["Aphex Twin"]),
      "xesam:album": new Variant("s", "Windowlicker EP"),
      "mpris:length": new Variant("x", 320_000_000n),
    };

    get PlaybackStatus(): string {
      return this.playbackStatus;
    }
    get Metadata(): Record<string, Variant> {
      return this.metadata;
    }

    setTitle(title: string): void {
      this.metadata = { ...this.metadata, "xesam:title": new Variant("s", title) };
      dbus.interface.Interface.emitPropertiesChanged(this, { Metadata: this.metadata }, []);
    }

    setStatus(status: string): void {
      this.playbackStatus = status;
      dbus.interface.Interface.emitPropertiesChanged(this, { PlaybackStatus: status }, []);
    }
  }
  (
    PlayerInterface as unknown as {
      configureMembers: (members: unknown) => void;
    }
  ).configureMembers({
    properties: {
      PlaybackStatus: { signature: "s", access: dbus.interface.ACCESS_READ },
      Metadata: { signature: "a{sv}", access: dbus.interface.ACCESS_READ },
    },
  });

  let player: PlayerInterface;

  beforeAll(async () => {
    removeSocketIfPresent(socketPath);
    daemon = spawn("dbus-daemon", ["--session", `--address=${busAddress}`, "--nofork"], {
      stdio: "ignore",
    });
    // Give the daemon a moment to create and bind its socket.
    await new Promise((resolve) => setTimeout(resolve, 300));

    mockBus = dbus.sessionBus({ busAddress });
    player = new PlayerInterface("org.mpris.MediaPlayer2.Player");
    mockBus.export("/org/mpris/MediaPlayer2", player);
    await mockBus.requestName("org.mpris.MediaPlayer2.TestPlayer", 0);
  }, 10_000);

  afterAll(() => {
    mockBus.disconnect();
    daemon.kill();
    removeSocketIfPresent(socketPath);
  });

  it("discovers the real player and reports its real initial metadata over real D-Bus", async () => {
    const source = createLinuxPlaybackSource({ sessionBus: () => dbus.sessionBus({ busAddress }) });
    const tracks: unknown[] = [];
    const states: unknown[] = [];
    const unsubTrack = source.onTrackChanged((t) => tracks.push(t));
    const unsubState = source.onPlaybackStateChanged((s) => states.push(s));

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(states).toContain("playing");
    expect(tracks).toContainEqual({
      title: "Windowlicker",
      artist: "Aphex Twin",
      album: "Windowlicker EP",
      durationSec: 320,
      sourceApp: "TestPlayer",
      isStream: false,
    });

    unsubTrack();
    unsubState();
  }, 10_000);

  it("delivers a live track change and playback-state change via real PropertiesChanged signals", async () => {
    player.setTitle("Come to Daddy");
    player.setStatus("Playing");

    const source = createLinuxPlaybackSource({ sessionBus: () => dbus.sessionBus({ busAddress }) });
    const tracks: { title: string }[] = [];
    const states: string[] = [];
    const unsubTrack = source.onTrackChanged((t) => tracks.push(t));
    const unsubState = source.onPlaybackStateChanged((s) => states.push(s));

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(tracks.at(-1)?.title).toBe("Come to Daddy");

    player.setStatus("Paused");
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(states.at(-1)).toBe("paused");

    unsubTrack();
    unsubState();
  }, 10_000);
});

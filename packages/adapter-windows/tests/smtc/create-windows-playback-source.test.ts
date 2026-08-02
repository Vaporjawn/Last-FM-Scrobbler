import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  createWindowsPlaybackSource,
  SmtcHelperNotBuiltError,
} from "../../src/smtc/create-windows-playback-source.js";

function createFakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: (signal?: NodeJS.Signals) => boolean;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn(() => true);
  return child;
}

function fakeResolveHelperPath(helperBuilt: boolean) {
  return vi.fn().mockReturnValue({ helperPath: "C:\\native-build\\SmtcHelper.exe", helperBuilt });
}

function writeLine(child: ReturnType<typeof createFakeChild>, value: unknown) {
  child.stdout.write(`${JSON.stringify(value)}\n`);
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("createWindowsPlaybackSource", () => {
  it("throws SmtcHelperNotBuiltError when the helper hasn't been built", () => {
    const source = createWindowsPlaybackSource({
      resolveHelperPathImpl: fakeResolveHelperPath(false),
      spawnImpl: vi.fn(),
    });

    expect(() => source.onTrackChanged(() => undefined)).toThrow(SmtcHelperNotBuiltError);
  });

  it("spawns the helper lazily on first subscription, sharing one process across both subscription methods", () => {
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const source = createWindowsPlaybackSource({
      resolveHelperPathImpl: fakeResolveHelperPath(true),
      spawnImpl,
    });

    source.onTrackChanged(() => undefined);
    source.onPlaybackStateChanged(() => undefined);

    expect(spawnImpl).toHaveBeenCalledTimes(1);
  });

  it("notifies onTrackChanged with a mapped TrackInfo for a valid payload", async () => {
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const source = createWindowsPlaybackSource({
      resolveHelperPathImpl: fakeResolveHelperPath(true),
      spawnImpl,
    });

    const tracks: unknown[] = [];
    source.onTrackChanged((t) => tracks.push(t));

    writeLine(fakeChild, {
      title: "Windowlicker",
      artist: "Aphex Twin",
      album: "Windowlicker EP",
      durationSec: 320,
      playbackStatus: "Playing",
      sourceAppUserModelId: "Spotify.exe",
    });
    await flush();

    expect(tracks).toEqual([
      {
        title: "Windowlicker",
        artist: "Aphex Twin",
        album: "Windowlicker EP",
        durationSec: 320,
        sourceApp: "Spotify.exe",
        isStream: false,
      },
    ]);
  });

  it("does not call onTrackChanged for a null payload (nothing is the current session)", async () => {
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const source = createWindowsPlaybackSource({
      resolveHelperPathImpl: fakeResolveHelperPath(true),
      spawnImpl,
    });

    const tracks: unknown[] = [];
    source.onTrackChanged((t) => tracks.push(t));

    writeLine(fakeChild, null);
    await flush();

    expect(tracks).toEqual([]);
  });

  it("notifies onPlaybackStateChanged with the mapped state on every event", async () => {
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const source = createWindowsPlaybackSource({
      resolveHelperPathImpl: fakeResolveHelperPath(true),
      spawnImpl,
    });

    const states: unknown[] = [];
    source.onPlaybackStateChanged((s) => states.push(s));

    writeLine(fakeChild, {
      title: "Song",
      sourceAppUserModelId: "App.exe",
      playbackStatus: "Playing",
    });
    writeLine(fakeChild, {
      title: "Song",
      sourceAppUserModelId: "App.exe",
      playbackStatus: "Paused",
    });
    writeLine(fakeChild, null);
    await flush();

    expect(states).toEqual(["playing", "paused", "stopped"]);
  });

  it("getPosition() resolves elapsedSec from the most recent event", async () => {
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const source = createWindowsPlaybackSource({
      resolveHelperPathImpl: fakeResolveHelperPath(true),
      spawnImpl,
    });
    source.onPlaybackStateChanged(() => undefined);

    writeLine(fakeChild, { title: "Song", sourceAppUserModelId: "App.exe", elapsedSec: 12.5 });
    await flush();

    await expect(source.getPosition()).resolves.toBe(12.5);
  });

  it("getPosition() resolves 0 before any event and after a null payload", async () => {
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const source = createWindowsPlaybackSource({
      resolveHelperPathImpl: fakeResolveHelperPath(true),
      spawnImpl,
    });

    await expect(source.getPosition()).resolves.toBe(0);

    source.onPlaybackStateChanged(() => undefined);
    writeLine(fakeChild, { title: "Song", sourceAppUserModelId: "App.exe", elapsedSec: 12.5 });
    await flush();
    writeLine(fakeChild, null);
    await flush();

    await expect(source.getPosition()).resolves.toBe(0);
  });

  it("stops the underlying process once every subscriber has unsubscribed", () => {
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const source = createWindowsPlaybackSource({
      resolveHelperPathImpl: fakeResolveHelperPath(true),
      spawnImpl,
    });

    const unsubscribeTrack = source.onTrackChanged(() => undefined);
    const unsubscribeState = source.onPlaybackStateChanged(() => undefined);
    unsubscribeTrack();
    expect(fakeChild.kill).not.toHaveBeenCalled();

    unsubscribeState();
    expect(fakeChild.kill).toHaveBeenCalled();
  });

  it("respawns the process if a new subscriber arrives after everyone unsubscribed", () => {
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const source = createWindowsPlaybackSource({
      resolveHelperPathImpl: fakeResolveHelperPath(true),
      spawnImpl,
    });

    const unsubscribe = source.onTrackChanged(() => undefined);
    unsubscribe();
    source.onTrackChanged(() => undefined);

    expect(spawnImpl).toHaveBeenCalledTimes(2);
  });
});

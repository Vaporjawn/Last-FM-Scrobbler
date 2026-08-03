import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createWindowsPlaybackSource } from "../../src/smtc/create-windows-playback-source.js";
import { SmtcHelperNotBuiltError } from "../../src/smtc/smtc-helper-not-built-error.js";

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

  it("does not re-notify listeners for consecutive payload lines reporting the same track/state", async () => {
    // Regression test: SMTC fires TimelinePropertiesChanged on ordinary playback-
    // position ticks (~1/sec), not just on genuine track/state changes — a single
    // payload line for the same track used to fire onTrackChanged/
    // onPlaybackStateChanged every time, spamming any consumer that treats either
    // event as "something actually changed."
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const source = createWindowsPlaybackSource({
      resolveHelperPathImpl: fakeResolveHelperPath(true),
      spawnImpl,
    });

    const tracks: unknown[] = [];
    const states: unknown[] = [];
    source.onTrackChanged((t) => tracks.push(t));
    source.onPlaybackStateChanged((s) => states.push(s));

    const payload = {
      title: "Windowlicker",
      artist: "Aphex Twin",
      durationSec: 320,
      playbackStatus: "Playing",
      sourceAppUserModelId: "Spotify.exe",
    };
    // Same track/state reported three times in a row, as a position-tick update would.
    writeLine(fakeChild, { ...payload, elapsedSec: 10 });
    writeLine(fakeChild, { ...payload, elapsedSec: 11 });
    writeLine(fakeChild, { ...payload, elapsedSec: 12 });
    await flush();

    expect(tracks).toHaveLength(1);
    expect(states).toEqual(["playing"]);
  });

  it("does still re-notify onTrackChanged when the track genuinely changes", async () => {
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
      sourceAppUserModelId: "Spotify.exe",
      playbackStatus: "Playing",
    });
    writeLine(fakeChild, {
      title: "Come to Daddy",
      sourceAppUserModelId: "Spotify.exe",
      playbackStatus: "Playing",
    });
    await flush();

    expect(tracks).toHaveLength(2);
  });

  it("surfaces a spawn failure via onError instead of throwing unhandled", () => {
    // Regression test: without a child.on("error", ...) listener, Node's ChildProcess
    // (an EventEmitter) throws on an unhandled 'error' event by default, crashing the
    // host process. This is the one lifecycle event the SMTC helper has never actually
    // been run against anywhere (no Windows toolchain in this sandbox).
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const onError = vi.fn();
    const source = createWindowsPlaybackSource({
      resolveHelperPathImpl: fakeResolveHelperPath(true),
      spawnImpl,
      onError,
    });

    source.onTrackChanged(() => undefined);
    const spawnError = new Error("spawn ENOENT");

    expect(() => {
      fakeChild.emit("error", spawnError);
    }).not.toThrow();
    expect(onError).toHaveBeenCalledWith(spawnError);
  });

  it("respawns after the helper process exits unexpectedly, without requiring an unsubscribe/resubscribe", () => {
    // Regression test: ensureStarted() used to never wire onExit, so a crashed/killed
    // helper left helperHandle truthy forever — the adapter was permanently stuck
    // reporting stale state, since a later subscription's ensureStarted() call was a
    // silent no-op.
    const firstChild = createFakeChild();
    const secondChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValueOnce(firstChild).mockReturnValueOnce(secondChild);
    const source = createWindowsPlaybackSource({
      resolveHelperPathImpl: fakeResolveHelperPath(true),
      spawnImpl,
    });

    source.onTrackChanged(() => undefined);
    expect(spawnImpl).toHaveBeenCalledTimes(1);

    // The helper crashes on its own — not via unsubscribe, so helperHandle isn't
    // cleared by stopIfNoSubscribers().
    firstChild.emit("exit", 1, null);

    // A still-subscribed caller has no way to know the process died; the adapter
    // itself should notice on the next event-producing opportunity. Simulate the
    // subscription layer asking for a fresh start the way `ensureStarted()` is
    // exercised elsewhere in this suite (a new subscription).
    source.onPlaybackStateChanged(() => undefined);

    expect(spawnImpl).toHaveBeenCalledTimes(2);
  });
});

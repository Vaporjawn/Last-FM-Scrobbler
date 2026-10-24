import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { PathLike } from "node:fs";
import type * as NodeFs from "node:fs";
import { describe, expect, it, vi } from "vitest";

/** Same technique as `index.test.ts`'s `mockFrameworkNotBuilt`, but reporting the
 * framework as present — lets these tests exercise the lazy spawn/teardown lifecycle
 * (previously untested, and previously not even implemented — the process used to be
 * spawned unconditionally in the constructor) with an injected `spawnImpl`, without an
 * actual macOS/perl/framework in the loop. */
function mockFrameworkBuilt(): void {
  vi.resetModules();
  vi.doMock("node:fs", async () => {
    const actual = await vi.importActual<typeof NodeFs>("node:fs");
    return {
      ...actual,
      existsSync: vi.fn((path: PathLike) =>
        String(path).includes("MediaRemoteAdapter.framework") ? true : actual.existsSync(path),
      ),
    };
  });
}

function createFakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    kill: (signal?: NodeJS.Signals) => boolean;
  };
  child.stdout = new PassThrough();
  child.kill = vi.fn(() => true);
  return child;
}

describe("createMacosPlaybackSource lifecycle", () => {
  it("does not spawn the perl process until the first subscription", async () => {
    mockFrameworkBuilt();
    const { createMacosPlaybackSource } = await import("../src/index.js");
    const spawnImpl = vi.fn();

    createMacosPlaybackSource({ spawnImpl });

    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("spawns lazily on first subscription, sharing one process across both subscription methods", async () => {
    mockFrameworkBuilt();
    const { createMacosPlaybackSource } = await import("../src/index.js");
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const source = createMacosPlaybackSource({ spawnImpl });

    source.onTrackChanged(() => undefined);
    source.onPlaybackStateChanged(() => undefined);

    expect(spawnImpl).toHaveBeenCalledTimes(1);
  });

  it("stops the underlying process once every subscriber has unsubscribed", async () => {
    // Regression test: previously the perl process was spawned eagerly and never
    // torn down — any caller that constructed a source without ever subscribing (an
    // adapter-availability probe, code trying multiple adapters) left an orphaned
    // process running for the app's entire lifetime.
    mockFrameworkBuilt();
    const { createMacosPlaybackSource } = await import("../src/index.js");
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const source = createMacosPlaybackSource({ spawnImpl });

    const unsubTrack = source.onTrackChanged(() => undefined);
    const unsubState = source.onPlaybackStateChanged(() => undefined);
    unsubTrack();
    expect(fakeChild.kill).not.toHaveBeenCalled();

    unsubState();
    expect(fakeChild.kill).toHaveBeenCalled();
  });

  it("respawns the process if a new subscriber arrives after everyone unsubscribed", async () => {
    mockFrameworkBuilt();
    const { createMacosPlaybackSource } = await import("../src/index.js");
    const spawnImpl = vi
      .fn()
      .mockReturnValueOnce(createFakeChild())
      .mockReturnValueOnce(createFakeChild());
    const source = createMacosPlaybackSource({ spawnImpl });

    const unsubscribe = source.onTrackChanged(() => undefined);
    unsubscribe();
    source.onTrackChanged(() => undefined);

    expect(spawnImpl).toHaveBeenCalledTimes(2);
  });

  it("surfaces a spawn error via onError instead of throwing unhandled", async () => {
    mockFrameworkBuilt();
    const { createMacosPlaybackSource } = await import("../src/index.js");
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const onError = vi.fn();
    const source = createMacosPlaybackSource({ spawnImpl, onError });

    source.onTrackChanged(() => undefined);
    const spawnError = new Error("spawn ENOENT");

    expect(() => {
      fakeChild.emit("error", spawnError);
    }).not.toThrow();
    expect(onError).toHaveBeenCalledWith(spawnError);
  });

  it("never throws on an unhandled 'error' event even with no onError given", async () => {
    mockFrameworkBuilt();
    const { createMacosPlaybackSource } = await import("../src/index.js");
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const source = createMacosPlaybackSource({ spawnImpl });

    source.onTrackChanged(() => undefined);

    expect(() => {
      fakeChild.emit("error", new Error("spawn ENOENT"));
    }).not.toThrow();
  });

  it("respawns after the process exits unexpectedly, without requiring an unsubscribe/resubscribe", async () => {
    // Regression test: previously there was no exit handler at all — a crashed/killed
    // perl process left the parser silently frozen on stale state forever, with the
    // next subscription's ensureStarted() being a permanent no-op (child was still
    // truthy).
    mockFrameworkBuilt();
    const { createMacosPlaybackSource } = await import("../src/index.js");
    const firstChild = createFakeChild();
    const secondChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValueOnce(firstChild).mockReturnValueOnce(secondChild);
    const source = createMacosPlaybackSource({ spawnImpl });

    source.onTrackChanged(() => undefined);
    expect(spawnImpl).toHaveBeenCalledTimes(1);

    firstChild.emit("exit", 1, null);
    source.onPlaybackStateChanged(() => undefined);

    expect(spawnImpl).toHaveBeenCalledTimes(2);
  });

  it("reports a non-zero exit through onError, including the signal when there is one", async () => {
    mockFrameworkBuilt();
    const { createMacosPlaybackSource } = await import("../src/index.js");
    const child = createFakeChild();
    const onError = vi.fn();
    const source = createMacosPlaybackSource({
      spawnImpl: vi.fn().mockReturnValue(child),
      onError,
    });

    source.onTrackChanged(() => undefined);
    child.emit("exit", 9, "SIGKILL");

    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]?.[0] as Error).message).toBe(
      "mediaremote-adapter exited with code 9 (signal: SIGKILL)",
    );
  });

  it("reports a non-zero exit without a signal as 'none'", async () => {
    mockFrameworkBuilt();
    const { createMacosPlaybackSource } = await import("../src/index.js");
    const child = createFakeChild();
    const onError = vi.fn();
    const source = createMacosPlaybackSource({
      spawnImpl: vi.fn().mockReturnValue(child),
      onError,
    });

    source.onTrackChanged(() => undefined);
    child.emit("exit", 2, null);

    expect((onError.mock.calls[0]?.[0] as Error).message).toBe(
      "mediaremote-adapter exited with code 2 (signal: none)",
    );
  });

  it("does not report a clean exit (code 0) or a signal-only exit (null code) as an error", async () => {
    mockFrameworkBuilt();
    const { createMacosPlaybackSource } = await import("../src/index.js");
    const first = createFakeChild();
    const second = createFakeChild();
    const onError = vi.fn();
    const source = createMacosPlaybackSource({
      spawnImpl: vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second),
      onError,
    });

    source.onTrackChanged(() => undefined);
    first.emit("exit", 0, null);
    source.onTrackChanged(() => undefined);
    second.emit("exit", null, "SIGTERM");

    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late exit notification from a process that was already replaced", async () => {
    mockFrameworkBuilt();
    const { createMacosPlaybackSource } = await import("../src/index.js");
    const first = createFakeChild();
    const second = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const source = createMacosPlaybackSource({ spawnImpl });

    const unsubscribe = source.onTrackChanged(() => undefined);
    unsubscribe(); // kills `first` and forgets it
    source.onTrackChanged(() => undefined); // spawns `second`
    first.emit("exit", 0, null); // stale: must not clear `second`
    source.onPlaybackStateChanged(() => undefined);

    expect(spawnImpl).toHaveBeenCalledTimes(2);
  });

  it("feeds the child's stdout lines through the parser and reports its position", async () => {
    mockFrameworkBuilt();
    const { createMacosPlaybackSource } = await import("../src/index.js");
    const child = createFakeChild();
    const source = createMacosPlaybackSource({ spawnImpl: vi.fn().mockReturnValue(child) });
    const tracks: unknown[] = [];
    const states: unknown[] = [];
    source.onTrackChanged((track) => tracks.push(track));
    source.onPlaybackStateChanged((state) => states.push(state));

    child.stdout.write(
      JSON.stringify({
        type: "data",
        diff: false,
        payload: { title: "Be Mine", artist: "Alabama Shakes", elapsedTime: 12, playing: false },
      }) + "\n",
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(tracks).toHaveLength(1);
    expect(states).toEqual(["paused"]);
    await expect(source.getPosition()).resolves.toBe(12);
  });

  describe("lifecycle races and leaks", () => {
    const PLAYING = JSON.stringify({
      type: "data",
      diff: false,
      payload: { title: "T", artist: "A", elapsedTime: 50, playing: true },
    });

    it("does not keep a listener registered when spawning the helper throws", async () => {
      mockFrameworkBuilt();
      const { createMacosPlaybackSource } = await import("../src/index.js");
      const child = createFakeChild();
      let failToSpawn = true;
      const spawnImpl = vi.fn().mockImplementation(() => {
        if (failToSpawn) {
          throw new Error("spawn refused");
        }
        return child;
      });
      const source = createMacosPlaybackSource({ spawnImpl });
      const abandoned = vi.fn();
      const abandonedState = vi.fn();

      expect(() => source.onTrackChanged(abandoned)).toThrow("spawn refused");
      expect(() => source.onPlaybackStateChanged(abandonedState)).toThrow("spawn refused");

      failToSpawn = false;
      source.onTrackChanged(() => undefined);
      child.stdout.write(`${PLAYING}\n`);
      await new Promise((resolve) => setImmediate(resolve));

      expect(abandoned).not.toHaveBeenCalled();
      expect(abandonedState).not.toHaveBeenCalled();
    });

    it("reports playback as stopped, and forgets the position, when the helper dies", async () => {
      mockFrameworkBuilt();
      const { createMacosPlaybackSource } = await import("../src/index.js");
      const child = createFakeChild();
      const source = createMacosPlaybackSource({ spawnImpl: vi.fn().mockReturnValue(child) });
      const states: string[] = [];
      source.onPlaybackStateChanged((state) => states.push(state));
      child.stdout.write(`${PLAYING}\n`);
      await new Promise((resolve) => setImmediate(resolve));
      expect(states).toEqual(["playing"]);

      child.emit("exit", 1, null);

      expect(states).toEqual(["playing", "stopped"]);
      await expect(source.getPosition()).resolves.toBe(0);
    });

    it("re-announces the same track after the helper was restarted", async () => {
      mockFrameworkBuilt();
      const { createMacosPlaybackSource } = await import("../src/index.js");
      const first = createFakeChild();
      const second = createFakeChild();
      const spawnImpl = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
      const source = createMacosPlaybackSource({ spawnImpl });
      const tracks: unknown[] = [];
      source.onTrackChanged((track) => tracks.push(track));
      first.stdout.write(`${PLAYING}\n`);
      await new Promise((resolve) => setImmediate(resolve));

      first.emit("exit", 1, null);
      source.onPlaybackStateChanged(() => undefined); // respawns
      second.stdout.write(`${PLAYING}\n`);
      await new Promise((resolve) => setImmediate(resolve));

      expect(tracks).toHaveLength(2);
    });

    it("forgets the last position once everyone has unsubscribed", async () => {
      mockFrameworkBuilt();
      const { createMacosPlaybackSource } = await import("../src/index.js");
      const child = createFakeChild();
      const source = createMacosPlaybackSource({ spawnImpl: vi.fn().mockReturnValue(child) });
      const unsubscribe = source.onTrackChanged(() => undefined);
      child.stdout.write(`${PLAYING.replace('"playing":true', '"playing":false')}\n`);
      await new Promise((resolve) => setImmediate(resolve));
      await expect(source.getPosition()).resolves.toBe(50);

      unsubscribe();

      await expect(source.getPosition()).resolves.toBe(0);
    });
  });
});

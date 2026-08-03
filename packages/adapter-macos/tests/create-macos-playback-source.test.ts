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
});

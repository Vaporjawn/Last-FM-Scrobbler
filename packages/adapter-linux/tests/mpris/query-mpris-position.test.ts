import { Variant, type MessageBus } from "dbus-next";
import { describe, expect, it, vi } from "vitest";
import { queryMprisPosition } from "../../src/mpris/query-mpris-position.js";

function fakeBus(getImpl: (iface: string, prop: string) => Promise<unknown>): MessageBus {
  return {
    getProxyObject: vi.fn().mockResolvedValue({
      getInterface: vi.fn().mockReturnValue({
        Get: getImpl,
      }),
    }),
  } as unknown as MessageBus;
}

describe("queryMprisPosition", () => {
  it("converts a Variant-wrapped microsecond Position to seconds", async () => {
    const bus = fakeBus(() => Promise.resolve(new Variant("x", 42_500_000n)));

    await expect(queryMprisPosition(bus, "org.mpris.MediaPlayer2.vlc")).resolves.toBe(42.5);
  });

  it("tolerates a plain-number Position instead of bigint", async () => {
    const bus = fakeBus(() => Promise.resolve(new Variant("x", 5_000_000)));

    await expect(queryMprisPosition(bus, "org.mpris.MediaPlayer2.vlc")).resolves.toBe(5);
  });

  it("resolves 0 rather than rejecting when the D-Bus call fails", async () => {
    const bus = fakeBus(() => Promise.reject(new Error("no such player")));

    await expect(queryMprisPosition(bus, "org.mpris.MediaPlayer2.vlc")).resolves.toBe(0);
  });

  it("resolves 0 when Position is missing/unrecognized", async () => {
    const bus = fakeBus(() => Promise.resolve(new Variant("x", undefined)));

    await expect(queryMprisPosition(bus, "org.mpris.MediaPlayer2.vlc")).resolves.toBe(0);
  });
});

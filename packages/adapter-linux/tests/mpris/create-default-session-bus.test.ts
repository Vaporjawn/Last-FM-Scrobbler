import type { MessageBus } from "dbus-next";
import { describe, expect, it, vi } from "vitest";
import { createDefaultSessionBus } from "../../src/mpris/create-default-session-bus.js";

const fakeBus = { fake: true } as unknown as MessageBus;

describe("createDefaultSessionBus", () => {
  it("opens the bus with the explicit address, normalised away from usocket", () => {
    const sessionBus = vi.fn().mockReturnValue(fakeBus);

    const bus = createDefaultSessionBus("unix:path=/run/user/1000/bus", {
      sessionBus,
      resolveAddress: () => "unix:path=/ignored",
    });

    expect(bus).toBe(fakeBus);
    expect(sessionBus).toHaveBeenCalledWith({ busAddress: "unix:socket=/run/user/1000/bus" });
  });

  it("uses the discovered address when none is given", () => {
    const sessionBus = vi.fn().mockReturnValue(fakeBus);

    createDefaultSessionBus(undefined, {
      sessionBus,
      resolveAddress: () => "unix:abstract=/tmp/dbus-x",
    });

    expect(sessionBus).toHaveBeenCalledWith({ busAddress: "unix:socket=\u0000/tmp/dbus-x" });
  });

  it("lets dbus-next do its own discovery when no address can be found", () => {
    const sessionBus = vi.fn().mockReturnValue(fakeBus);

    createDefaultSessionBus(undefined, { sessionBus, resolveAddress: () => undefined });

    expect(sessionBus).toHaveBeenCalledWith({});
  });
});

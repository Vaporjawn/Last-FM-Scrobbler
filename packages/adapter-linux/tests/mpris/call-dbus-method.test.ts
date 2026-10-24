import { describe, expect, it, vi } from "vitest";
import type { ClientInterface } from "dbus-next";
import { callDBusMethod } from "../../src/mpris/call-dbus-method.js";

describe("callDBusMethod", () => {
  it("invokes the named method with the interface as `this` and forwards every argument", async () => {
    const iface = {
      Echo(this: unknown, ...args: unknown[]) {
        return Promise.resolve({ self: this, args });
      },
    } as unknown as ClientInterface;

    const result = (await callDBusMethod(iface, "Echo", "a", 2)) as {
      self: unknown;
      args: unknown[];
    };

    expect(result.self).toBe(iface);
    expect(result.args).toEqual(["a", 2]);
  });

  it("throws a clear error when the remote object does not implement the method", async () => {
    const iface = { Other: vi.fn() } as unknown as ClientInterface;

    await expect(callDBusMethod(iface, "Missing")).rejects.toThrow(
      'D-Bus interface has no method "Missing"',
    );
  });
});

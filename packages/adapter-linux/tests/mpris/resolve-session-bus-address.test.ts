import { describe, expect, it } from "vitest";
import { resolveSessionBusAddress } from "../../src/mpris/resolve-session-bus-address.js";

describe("resolveSessionBusAddress", () => {
  it("prefers DBUS_SESSION_BUS_ADDRESS from the environment", () => {
    expect(
      resolveSessionBusAddress({
        env: { DBUS_SESSION_BUS_ADDRESS: "unix:abstract=/tmp/dbus-x" },
        uid: 1000,
        exists: () => true,
      }),
    ).toBe("unix:abstract=/tmp/dbus-x");
  });

  it("falls back to systemd's per-user socket when it exists", () => {
    const checked: string[] = [];
    const address = resolveSessionBusAddress({
      env: {},
      uid: 1000,
      exists: (path) => {
        checked.push(path);
        return true;
      },
    });
    expect(address).toBe("unix:path=/run/user/1000/bus");
    expect(checked).toEqual(["/run/user/1000/bus"]);
  });

  it("returns undefined when neither is available so dbus-next can discover one itself", () => {
    expect(resolveSessionBusAddress({ env: {}, uid: 1000, exists: () => false })).toBeUndefined();
  });

  it("returns undefined without checking the filesystem when there is no user id", () => {
    expect(
      resolveSessionBusAddress({
        env: {},
        uid: undefined,
        exists: () => {
          throw new Error("should not be consulted");
        },
      }),
    ).toBeUndefined();
  });

  it("treats an empty variable as unset", () => {
    expect(
      resolveSessionBusAddress({
        env: { DBUS_SESSION_BUS_ADDRESS: "" },
        uid: 7,
        exists: () => true,
      }),
    ).toBe("unix:path=/run/user/7/bus");
  });

  it("checks the real filesystem by default (an implausible user id has no socket)", () => {
    expect(resolveSessionBusAddress({ env: {}, uid: 987_654_321 })).toBeUndefined();
  });

  it("reads the real environment and user id by default", () => {
    // Whatever this machine has, the call must not throw and must yield a string or undefined.
    const address = resolveSessionBusAddress();
    expect(address === undefined || typeof address === "string").toBe(true);
  });
});

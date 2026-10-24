import { describe, expect, it } from "vitest";
import { normalizeDbusAddress } from "../../src/mpris/normalize-dbus-address.js";

describe("normalizeDbusAddress", () => {
  it("rewrites a unix:path address to unix:socket so dbus-next uses plain net", () => {
    expect(normalizeDbusAddress("unix:path=/run/user/1000/bus")).toBe(
      "unix:socket=/run/user/1000/bus",
    );
  });

  it("keeps trailing parameters such as guid", () => {
    expect(normalizeDbusAddress("unix:path=/run/user/1000/bus,guid=abc123")).toBe(
      "unix:socket=/run/user/1000/bus,guid=abc123",
    );
  });

  it("rewrites unix:abstract to a socket path with a leading NUL (Linux abstract namespace)", () => {
    expect(normalizeDbusAddress("unix:abstract=/tmp/dbus-AbCdEf,guid=ff")).toBe(
      "unix:socket=\u0000/tmp/dbus-AbCdEf,guid=ff",
    );
  });

  it("decodes percent-escapes in the path", () => {
    expect(normalizeDbusAddress("unix:path=/run/user/1000/my%20bus")).toBe(
      "unix:socket=/run/user/1000/my bus",
    );
  });

  it("handles several ;-separated candidates independently", () => {
    expect(normalizeDbusAddress("unix:path=/a;unix:abstract=/b;tcp:host=h,port=1")).toBe(
      "unix:socket=/a;unix:socket=\u0000/b;tcp:host=h,port=1",
    );
  });

  it("leaves addresses that already avoid usocket untouched", () => {
    expect(normalizeDbusAddress("unix:socket=/already")).toBe("unix:socket=/already");
    expect(normalizeDbusAddress("tcp:host=localhost,port=55556")).toBe(
      "tcp:host=localhost,port=55556",
    );
    expect(normalizeDbusAddress("unixexec:path=/usr/bin/dbus-launch")).toBe(
      "unixexec:path=/usr/bin/dbus-launch",
    );
  });

  it("keeps parameters that have no value", () => {
    expect(normalizeDbusAddress("unix:path=/a,noequals")).toBe("unix:socket=/a,noequals");
  });

  it("returns undefined for a missing or empty address so dbus-next can use its own discovery", () => {
    expect(normalizeDbusAddress(undefined)).toBeUndefined();
    expect(normalizeDbusAddress("")).toBeUndefined();
  });
});

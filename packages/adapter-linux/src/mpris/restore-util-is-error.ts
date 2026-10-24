import util from "node:util";

/**
 * Restores `util.isError` when the running Node has removed it.
 *
 * `usocket` (the native Unix-socket addon `dbus-next` uses for `unix:abstract=` and
 * `unix:path=` session buses — i.e. a normal Linux desktop) calls `util.isError(...)`
 * on every socket write. Node removed that function in v23, and Electron 43 bundles
 * Node 24, so without this the packaged Linux app throws
 * `TypeError: util.isError is not a function` on the first D-Bus handshake write and
 * MPRIS never connects. `usocket` is unmaintained, so the function is restored here
 * with the same semantics Node documented for it (an `Error` instance, or anything
 * `Object.prototype.toString` tags as an Error).
 *
 * Importing this module for its side effect, before `dbus-next` opens a connection,
 * is all that is required. It is a no-op on Node versions that still ship the
 * function, and never overwrites an existing implementation.
 */
export function restoreUtilIsError(): void {
  const target = util as unknown as { isError?: (value: unknown) => boolean };
  if (typeof target.isError === "function") {
    return;
  }
  target.isError = (value: unknown): boolean =>
    value instanceof Error || Object.prototype.toString.call(value) === "[object Error]";
}

restoreUtilIsError();

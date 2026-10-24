import { normalizeCandidate } from "./normalize-candidate.js";
/**
 * Rewrites a D-Bus bus address so `dbus-next` connects with Node's own `net` module and
 * never loads the native `usocket` addon.
 *
 * Why: for `unix:abstract=` (required) and `unix:path=` (preferred) addresses,
 * `dbus-next` constructs a `usocket.USocket`. That addon is unmaintained, and in the
 * packaged Electron 43 app on Linux, merely opening the session bus crashed the whole
 * process with SIGTRAP (reproduced by launching the built artifact under a session bus
 * with and without `uwrap.node`: crash with it, healthy without it). Every real desktop
 * has a session bus, so the packaged app would have died at launch for every user.
 *
 * `usocket` only exists to pass file descriptors over the socket, which MPRIS metadata
 * never needs. `dbus-next` takes a plain `net.createConnection(params.socket)` path for
 * `unix:socket=<path>`, and Node's `net` connects to Linux abstract-namespace sockets
 * when the path starts with a NUL character, so both forms can be expressed as
 * `unix:socket=`.
 *
 * Other transports (`tcp:`, `unixexec:`, an existing `unix:socket=`) pass through
 * unchanged, as do trailing parameters such as `guid=`. Returns `undefined` for a
 * missing/empty address so `dbus-next` can run its own discovery.
 */
export function normalizeDbusAddress(address: string | undefined): string | undefined {
  if (address === undefined || address === "") {
    return undefined;
  }
  return address
    .split(";")
    .map((candidate) => normalizeCandidate(candidate))
    .join(";");
}

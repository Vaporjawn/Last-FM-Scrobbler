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

function normalizeCandidate(candidate: string): string {
  const separator = candidate.indexOf(":");
  if (separator === -1 || candidate.slice(0, separator).toLowerCase() !== "unix") {
    return candidate;
  }

  const parameters = candidate
    .slice(separator + 1)
    .split(",")
    .map((parameter) => {
      const equals = parameter.indexOf("=");
      if (equals === -1) {
        return parameter;
      }
      const key = parameter.slice(0, equals);
      const value = parameter.slice(equals + 1);
      if (key === "path") {
        return `socket=${decodeEscapes(value)}`;
      }
      if (key === "abstract") {
        return `socket=\u0000${decodeEscapes(value)}`;
      }
      return parameter;
    });

  return `${candidate.slice(0, separator)}:${parameters.join(",")}`;
}

/** D-Bus address values may be `%XX`-escaped; dbus-next does not decode them itself. */
function decodeEscapes(value: string): string {
  return value.replace(/%([0-9a-fA-F]{2})/g, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

# 0012: Keep dbus-next off the native usocket addon

## Status

Accepted

## Context

`dbus-next` builds a `usocket.USocket` (a native C++ addon) for `unix:abstract=` bus
addresses (required) and for `unix:path=` addresses (preferred, with a `net` fallback
only if loading throws). `usocket` exists to pass file descriptors over the socket,
which MPRIS never needs, and it is unmaintained.

Two separate failures traced back to it, both found only by running real artifacts:

1. **Node 23+ removed `util.isError`**, which `usocket` calls on every write. Under
   Node 26 the MPRIS smoke test (a real `dbus-daemon`) threw `util.isError is not a
function`. A shim that redefined it fixed that symptom.
2. **The packaged Linux app crashed at launch with SIGTRAP** whenever a session bus
   existed, which is every real desktop. The release workflow's packaged-app smoke
   test caught it. Launching the built artifact in three configurations isolated it:
   no bus runs healthy; a bus with `uwrap.node` present crashes within two seconds; a
   bus with `uwrap.node` removed runs healthy. A shim cannot fix a native crash.

## Decision

Never let `dbus-next` load `usocket`. `normalizeDbusAddress`
(`packages/adapter-linux/src/mpris/normalize-dbus-address.ts`) rewrites bus addresses
before they reach `dbus-next`:

- `unix:path=P` becomes `unix:socket=P`
- `unix:abstract=A` becomes `unix:socket=<NUL>A` (Node's `net` connects to the Linux
  abstract namespace when the path starts with a NUL)
- everything else (`tcp:`, `unixexec:`, an existing `unix:socket=`, trailing `guid=`
  parameters) passes through unchanged.

`dbus-next` handles `unix:socket=` with a plain `net.createConnection`. The default
bus is `$DBUS_SESSION_BUS_ADDRESS`, then systemd's `/run/user/<uid>/bus`
(`resolve-session-bus-address.ts`, `create-default-session-bus.ts`). The `util.isError`
shim was removed once `usocket` could no longer be reached.

## Consequences

- No file-descriptor passing. MPRIS does not use it.
- The D-Bus smoke test runs over both address forms (abstract on Linux only) and
  asserts that no module under `usocket/` is ever loaded; with the mock bus given a raw
  address that assertion fails.
- `usocket` is still installed and compiled as an optional dependency of `dbus-next`
  (and prints a build error on Windows, where it is optional). It is simply never
  required. Replacing `dbus-next` with a maintained client would remove it entirely and
  is a reasonable future change; the normalisation is the minimal fix.
- If the session bus address cannot be found at all, discovery is left to `dbus-next`
  (which can read an X11 property). A discovered abstract address on that route would
  still reach `usocket`; no real desktop was observed to take it.

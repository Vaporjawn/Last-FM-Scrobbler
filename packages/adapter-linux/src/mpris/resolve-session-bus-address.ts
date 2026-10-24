import { existsSync } from "node:fs";
import { getCurrentUserId } from "./get-current-user-id.js";

/**
 * Seams for `resolveSessionBusAddress`, so tests can supply a fake environment, user id
 * and file-existence check instead of reading the real machine.
 */
export interface ResolveSessionBusAddressOptions {
  /** Injectable for testing; defaults to `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Injectable for testing; defaults to the current user's id (absent on Windows). */
  readonly uid?: number | undefined;
  /** Injectable for testing; defaults to `fs.existsSync`. */
  readonly exists?: (path: string) => boolean;
}

/**
 * Finds the session bus address to use: `$DBUS_SESSION_BUS_ADDRESS` when set, else
 * systemd's per-user socket (`/run/user/<uid>/bus`) when it exists, else `undefined` so
 * `dbus-next` can run its own discovery.
 */
export function resolveSessionBusAddress(
  options: ResolveSessionBusAddressOptions = {},
): string | undefined {
  const fromEnvironment = (options.env ?? process.env).DBUS_SESSION_BUS_ADDRESS;
  if (fromEnvironment) {
    return fromEnvironment;
  }

  const uid = "uid" in options ? options.uid : getCurrentUserId();
  if (uid === undefined) {
    return undefined;
  }
  const systemdSocket = `/run/user/${String(uid)}/bus`;
  return (options.exists ?? existsSync)(systemdSocket) ? `unix:path=${systemdSocket}` : undefined;
}

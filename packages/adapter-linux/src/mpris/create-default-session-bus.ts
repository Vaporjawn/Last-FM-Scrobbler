import { sessionBus as dbusSessionBus, type MessageBus } from "dbus-next";
import { normalizeDbusAddress } from "./normalize-dbus-address.js";
import { resolveSessionBusAddress } from "./resolve-session-bus-address.js";

export interface CreateDefaultSessionBusDependencies {
  /** Injectable for testing; defaults to `dbus-next`'s real `sessionBus`. */
  readonly sessionBus?: typeof dbusSessionBus;
  /** Injectable for testing; defaults to `resolveSessionBusAddress`. */
  readonly resolveAddress?: () => string | undefined;
}

/**
 * Opens the user's session bus through `dbus-next`, with the address normalised so the
 * native `usocket` addon is never loaded (it crashes the packaged Electron app; see
 * `normalizeDbusAddress`). An explicit `busAddress` wins over discovery.
 */
export function createDefaultSessionBus(
  busAddress?: string,
  dependencies: CreateDefaultSessionBusDependencies = {},
): MessageBus {
  const resolveAddress = dependencies.resolveAddress ?? resolveSessionBusAddress;
  const normalized = normalizeDbusAddress(busAddress ?? resolveAddress());
  return (dependencies.sessionBus ?? dbusSessionBus)(
    normalized === undefined ? {} : { busAddress: normalized },
  );
}

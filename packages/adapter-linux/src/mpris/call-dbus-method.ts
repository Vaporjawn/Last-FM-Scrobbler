import type { ClientInterface } from "dbus-next";

/**
 * Calls a method on a dbus-next `ClientInterface` by name. `ClientInterface`'s type is
 * an index signature (`[name: string]: Function`), which under `noUncheckedIndexedAccess`
 * TypeScript treats as possibly `undefined` — this centralizes the one defensive check
 * that requires, throwing a clear error in the (only realistic) case where the remote
 * object doesn't actually implement the method its introspection data promised.
 */
export async function callDBusMethod(
  iface: ClientInterface,
  methodName: string,
  ...args: unknown[]
): Promise<unknown> {
  const method = iface[methodName];
  if (typeof method !== "function") {
    throw new Error(`D-Bus interface has no method "${methodName}"`);
  }
  return (method as (...methodArgs: unknown[]) => Promise<unknown>).apply(iface, args);
}

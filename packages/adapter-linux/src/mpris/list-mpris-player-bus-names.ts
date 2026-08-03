import type { MessageBus } from "dbus-next";
import { callDBusMethod } from "./call-dbus-method.js";
import { DBUS_PATH, DBUS_SERVICE, MPRIS_PREFIX } from "./mpris-discovery-dbus-names.js";

/** Lists the bus names of every currently-running MPRIS2 player on the given bus. */
export async function listMprisPlayerBusNames(bus: MessageBus): Promise<string[]> {
  const obj = await bus.getProxyObject(DBUS_SERVICE, DBUS_PATH);
  const iface = obj.getInterface(DBUS_SERVICE);
  const names = (await callDBusMethod(iface, "ListNames")) as string[];
  return names.filter((name) => name.startsWith(MPRIS_PREFIX));
}

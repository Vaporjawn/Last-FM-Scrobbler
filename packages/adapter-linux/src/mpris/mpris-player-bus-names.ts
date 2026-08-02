import type { MessageBus } from "dbus-next";
import { callDBusMethod } from "./call-dbus-method.js";

const MPRIS_PREFIX = "org.mpris.MediaPlayer2.";
const DBUS_SERVICE = "org.freedesktop.DBus";
const DBUS_PATH = "/org/freedesktop/DBus";

/** Lists the bus names of every currently-running MPRIS2 player on the given bus. */
export async function listMprisPlayerBusNames(bus: MessageBus): Promise<string[]> {
  const obj = await bus.getProxyObject(DBUS_SERVICE, DBUS_PATH);
  const iface = obj.getInterface(DBUS_SERVICE);
  const names = (await callDBusMethod(iface, "ListNames")) as string[];
  return names.filter((name) => name.startsWith(MPRIS_PREFIX));
}

export interface NameOwnerChange {
  readonly busName: string;
  /** True if this name just appeared (a player started); false if it just vanished. */
  readonly appeared: boolean;
}

export type Unsubscribe = () => void;

/**
 * Watches for MPRIS players starting or stopping, via `org.freedesktop.DBus`'s
 * `NameOwnerChanged` signal (fired for every bus name change; filtered here to just
 * the `org.mpris.MediaPlayer2.*` prefix).
 */
export async function watchMprisPlayerLifecycle(
  bus: MessageBus,
  onChange: (change: NameOwnerChange) => void,
): Promise<Unsubscribe> {
  const obj = await bus.getProxyObject(DBUS_SERVICE, DBUS_PATH);
  const iface = obj.getInterface(DBUS_SERVICE);

  const listener = (name: string, oldOwner: string, newOwner: string): void => {
    if (!name.startsWith(MPRIS_PREFIX)) {
      return;
    }
    if (newOwner !== "") {
      onChange({ busName: name, appeared: true });
    } else if (oldOwner !== "") {
      onChange({ busName: name, appeared: false });
    }
  };

  iface.on("NameOwnerChanged", listener);
  return () => {
    iface.off("NameOwnerChanged", listener);
  };
}

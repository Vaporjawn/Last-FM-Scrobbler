import type { MessageBus } from "dbus-next";
import { callDBusMethod } from "./call-dbus-method.js";
import { MPRIS_PATH, PLAYER_IFACE, PROPERTIES_IFACE } from "./mpris-dbus-names.js";
import { unwrapVariant } from "./unwrap-variant.js";

/**
 * Queries an MPRIS player's current transport position on demand, converted from
 * microseconds to seconds. MPRIS explicitly documents `Position` as unsuitable for
 * `PropertiesChanged` notifications (it would mean a signal every ~16ms), so unlike
 * `Metadata`/`PlaybackStatus` this must be actively polled rather than pushed.
 *
 * Never rejects — a player that's gone, unreachable, or returns something unexpected
 * resolves to `0` rather than surfacing a scrobble-irrelevant transport detail as a
 * hard error.
 */
export async function queryMprisPosition(bus: MessageBus, busName: string): Promise<number> {
  try {
    const obj = await bus.getProxyObject(busName, MPRIS_PATH);
    const properties = obj.getInterface(PROPERTIES_IFACE);
    const result = await callDBusMethod(properties, "Get", PLAYER_IFACE, "Position");
    const micros = unwrapVariant(result);

    if (typeof micros === "bigint") {
      return Number(micros) / 1_000_000;
    }
    if (typeof micros === "number") {
      return micros / 1_000_000;
    }
    return 0;
  } catch {
    return 0;
  }
}

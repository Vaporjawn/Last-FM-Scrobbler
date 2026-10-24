import type { MessageBus } from "dbus-next";
import type { Unsubscribe } from "@lastfm-scrobbler/shared-types";
import { DBUS_PATH, DBUS_SERVICE, MPRIS_PREFIX } from "./mpris-discovery-dbus-names.js";

/** A player's bus name gaining or losing an owner, as reported to `watchMprisPlayerLifecycle`'s callback. */
export interface NameOwnerChange {
  readonly busName: string;
  /** True if this name just appeared (a player started); false if it just vanished. */
  readonly appeared: boolean;
}

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

  /**
   * Handles `NameOwnerChanged(name, oldOwner, newOwner)`: an empty `oldOwner` means the
   * name was just claimed, an empty `newOwner` means it was released. A change of owner
   * between two non-empty values is reported as "appeared" so the player is re-watched.
   */
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

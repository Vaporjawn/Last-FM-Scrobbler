// The base `org.freedesktop.DBus` service/path (for bus-name enumeration and
// `NameOwnerChanged`) plus the MPRIS2 bus-name prefix used to filter to just media
// players — distinct from `mpris-dbus-names.ts`'s per-player `Player`/`Properties`
// interface names, which are used to talk to one already-discovered player rather than
// to discover/watch the *set* of players. Shared by `listMprisPlayerBusNames` and
// `watchMprisPlayerLifecycle`, which both talk to the D-Bus daemon itself.

/**
 * Well-known-name prefix every MPRIS2 player claims on the session bus (for example
 * `org.mpris.MediaPlayer2.spotify`); used to pick media players out of all bus names.
 */
export const MPRIS_PREFIX = "org.mpris.MediaPlayer2.";
/** Bus name and interface of the D-Bus daemon itself, which lists names and signals owner changes. */
export const DBUS_SERVICE = "org.freedesktop.DBus";
/** Object path of the D-Bus daemon's own `org.freedesktop.DBus` object. */
export const DBUS_PATH = "/org/freedesktop/DBus";

// The base `org.freedesktop.DBus` service/path (for bus-name enumeration and
// `NameOwnerChanged`) plus the MPRIS2 bus-name prefix used to filter to just media
// players — distinct from `mpris-dbus-names.ts`'s per-player `Player`/`Properties`
// interface names, which are used to talk to one already-discovered player rather than
// to discover/watch the *set* of players. Shared by `listMprisPlayerBusNames` and
// `watchMprisPlayerLifecycle`, which both talk to the D-Bus daemon itself.

export const MPRIS_PREFIX = "org.mpris.MediaPlayer2.";
export const DBUS_SERVICE = "org.freedesktop.DBus";
export const DBUS_PATH = "/org/freedesktop/DBus";

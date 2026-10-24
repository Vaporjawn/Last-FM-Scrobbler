// The MPRIS2 (Media Player Remote Interfacing Specification) D-Bus object path and
// interface names every player exposes — see https://specifications.freedesktop.org/mpris-spec/.
// Always used together (an MPRIS call needs the object path plus one of the two
// interface names), so kept as one small, tightly-cohesive group rather than three
// separate one-line files.

/** Object path at which every MPRIS2 player exposes its interfaces on its own bus name. */
export const MPRIS_PATH = "/org/mpris/MediaPlayer2";
/** MPRIS2 `Player` interface: carries `Metadata`, `PlaybackStatus` and `Position`. */
export const PLAYER_IFACE = "org.mpris.MediaPlayer2.Player";
/**
 * Standard D-Bus `Properties` interface, used to `Get`/`GetAll` the player's properties
 * and to receive their `PropertiesChanged` signal.
 */
export const PROPERTIES_IFACE = "org.freedesktop.DBus.Properties";

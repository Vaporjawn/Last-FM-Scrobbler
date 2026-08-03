// The MPRIS2 (Media Player Remote Interfacing Specification) D-Bus object path and
// interface names every player exposes — see https://specifications.freedesktop.org/mpris-spec/.
// Always used together (an MPRIS call needs the object path plus one of the two
// interface names), so kept as one small, tightly-cohesive group rather than three
// separate one-line files.

export const MPRIS_PATH = "/org/mpris/MediaPlayer2";
export const PLAYER_IFACE = "org.mpris.MediaPlayer2.Player";
export const PROPERTIES_IFACE = "org.freedesktop.DBus.Properties";

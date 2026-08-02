const MPRIS_PREFIX = "org.mpris.MediaPlayer2.";
const INSTANCE_SUFFIX = /\.instance[^.]*$/;

/**
 * Derives a stable `TrackInfo.sourceApp` value from an MPRIS D-Bus bus name, e.g.
 * `"org.mpris.MediaPlayer2.firefox.instance1_2"` -> `"firefox"`. Per the MPRIS spec,
 * a player MUST request a name of the form `org.mpris.MediaPlayer2.<name>`, and MAY
 * append `.instanceN` (or similar) when multiple instances of the same player are
 * running — stripping both keeps `sourceApp` a stable identifier suitable for the
 * filter DSL (see docs/adr/0005-multi-source-and-track-identity-policy.md's
 * `sourceApp == "firefox"` example).
 */
export function deriveSourceAppFromBusName(busName: string): string {
  if (!busName.startsWith(MPRIS_PREFIX)) {
    return busName;
  }
  return busName.slice(MPRIS_PREFIX.length).replace(INSTANCE_SUFFIX, "");
}

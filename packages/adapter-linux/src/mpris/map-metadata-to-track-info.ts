import type { TrackInfo } from "@lastfm-scrobbler/shared-types";

/** Unwraps a dbus-next `Variant` (`{signature, value}`) if present; passes plain values through. */
function unwrap(value: unknown): unknown {
  if (value && typeof value === "object" && "value" in value) {
    return value.value;
  }
  return value;
}

function readString(value: unknown): string | undefined {
  const unwrapped = unwrap(value);
  return typeof unwrapped === "string" ? unwrapped : undefined;
}

/**
 * MPRIS's `xesam:artist`/`xesam:albumArtist` are spec'd as string arrays (`as`), but
 * some real-world players send a plain string instead — this accepts both and joins
 * multi-artist arrays with ", " (matches how Last.fm scrobbles multi-artist tracks).
 */
function readStringOrStringList(value: unknown): string | undefined {
  const unwrapped = unwrap(value);
  if (typeof unwrapped === "string") {
    return unwrapped;
  }
  if (Array.isArray(unwrapped)) {
    const strings: string[] = [];
    for (const item of unwrapped as unknown[]) {
      if (typeof item !== "string") {
        return undefined;
      }
      strings.push(item);
    }
    return strings.join(", ");
  }
  return undefined;
}

/** `mpris:length` is microseconds, as a signed 64-bit int — commonly a `bigint`, sometimes a plain `number`. */
function readDurationSec(value: unknown): number | undefined {
  const unwrapped = unwrap(value);
  let micros: number | undefined;
  if (typeof unwrapped === "bigint") {
    micros = Number(unwrapped);
  } else if (typeof unwrapped === "number") {
    micros = unwrapped;
  }
  if (micros === undefined || micros <= 0) {
    return undefined;
  }
  return micros / 1_000_000;
}

/**
 * Maps an MPRIS `Metadata` property (an `a{sv}` dict, values possibly Variant-wrapped)
 * to a `TrackInfo`, or `null` when `xesam:title` — the one field this adapter treats as
 * mandatory — is missing or empty. `sourceApp` is passed in separately (derived from the
 * D-Bus bus name by the caller) since MPRIS metadata has no equivalent field.
 */
export function mapMetadataToTrackInfo(
  metadata: Record<string, unknown>,
  sourceApp: string,
): TrackInfo | null {
  const title = readString(metadata["xesam:title"]);
  if (!title) {
    return null;
  }

  const album = readString(metadata["xesam:album"]);
  const albumArtist = readStringOrStringList(metadata["xesam:albumArtist"]);
  const durationSec = readDurationSec(metadata["mpris:length"]);

  return {
    title,
    artist: readStringOrStringList(metadata["xesam:artist"]) ?? "",
    ...(album ? { album } : {}),
    ...(albumArtist ? { albumArtist } : {}),
    ...(durationSec !== undefined ? { durationSec } : {}),
    sourceApp,
    isStream: durationSec === undefined,
  };
}

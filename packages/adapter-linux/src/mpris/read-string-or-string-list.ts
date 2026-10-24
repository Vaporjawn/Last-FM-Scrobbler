import { unwrapVariant } from "./unwrap-variant.js";

/**
 * MPRIS's `xesam:artist`/`xesam:albumArtist` are spec'd as string arrays (`as`), but
 * some real-world players send a plain string instead — this accepts both and joins
 * multi-artist arrays with ", " (matches how Last.fm scrobbles multi-artist tracks).
 */
export function readStringOrStringList(value: unknown): string | undefined {
  const unwrapped = unwrapVariant(value);
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

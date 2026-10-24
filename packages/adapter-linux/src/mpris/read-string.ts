import { unwrapVariant } from "./unwrap-variant.js";

/**
 * Reads a string out of a D-Bus value that may still be wrapped in a `dbus-next`
 * `Variant`, returning `undefined` if the unwrapped value is not a string.
 */
export function readString(value: unknown): string | undefined {
  const unwrapped = unwrapVariant(value);
  return typeof unwrapped === "string" ? unwrapped : undefined;
}

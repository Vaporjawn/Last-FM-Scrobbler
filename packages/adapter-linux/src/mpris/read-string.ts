import { unwrapVariant } from "./unwrap-variant.js";

export function readString(value: unknown): string | undefined {
  const unwrapped = unwrapVariant(value);
  return typeof unwrapped === "string" ? unwrapped : undefined;
}

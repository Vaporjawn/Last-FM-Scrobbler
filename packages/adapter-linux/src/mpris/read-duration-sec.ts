import { unwrapVariant } from "./unwrap-variant.js";

/** `mpris:length` is microseconds, as a signed 64-bit int — commonly a `bigint`, sometimes a plain `number`. */
export function readDurationSec(value: unknown): number | undefined {
  const unwrapped = unwrapVariant(value);
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

/**
 * Narrows an already-unwrapped D-Bus value to a string, returning `undefined` for anything
 * else (a missing property, a number, an object). Lets callers treat an absent or
 * wrongly-typed `PlaybackStatus` the same way instead of throwing on a misbehaving player.
 */
export function asStringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

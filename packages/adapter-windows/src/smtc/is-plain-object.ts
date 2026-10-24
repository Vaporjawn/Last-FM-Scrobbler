/**
 * Type guard for a non-null, non-array object, used to reject JSON values such as
 * numbers, strings and arrays that are valid JSON but cannot be a now-playing payload.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

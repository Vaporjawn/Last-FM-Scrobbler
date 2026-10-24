/**
 * Type guard for a finite whole number whose magnitude is at most `limit`. Rejects `NaN`,
 * infinities, fractions and non-numbers, so untrusted values are range-checked in one step.
 */
export function isInteger(value: unknown, limit: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && Math.abs(value) <= limit;
}

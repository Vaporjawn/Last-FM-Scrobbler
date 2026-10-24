export function isInteger(value: unknown, limit: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && Math.abs(value) <= limit;
}

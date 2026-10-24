export function asStringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

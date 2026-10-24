/** Narrow, structural check — real Last.fm errors always have both fields. */
export function isErrorPayload(value: unknown): value is { error: number; message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    "message" in value &&
    typeof (value as { error: unknown }).error === "number"
  );
}

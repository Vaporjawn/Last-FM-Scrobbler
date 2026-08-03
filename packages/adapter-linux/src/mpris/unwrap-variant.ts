/** Unwraps a dbus-next `Variant` if present; passes plain values through unchanged. */
export function unwrapVariant(value: unknown): unknown {
  if (value && typeof value === "object" && "value" in value) {
    return value.value;
  }
  return value;
}

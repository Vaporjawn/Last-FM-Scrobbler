/** D-Bus address values may be `%XX`-escaped; dbus-next does not decode them itself. */
export function decodeEscapes(value: string): string {
  return value.replace(/%([0-9a-fA-F]{2})/g, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

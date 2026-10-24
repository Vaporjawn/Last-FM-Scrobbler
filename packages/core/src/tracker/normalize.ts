/** Trims and lowercases a metadata string so that differently-cased or padded copies of the same artist/title/album compare equal when building a track identity. */
export function normalize(value: string): string {
  return value.trim().toLowerCase();
}

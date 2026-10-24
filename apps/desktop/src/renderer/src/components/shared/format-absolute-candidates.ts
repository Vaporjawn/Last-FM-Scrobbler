export function formatAbsoluteCandidates(
  timestamp: number,
): readonly [string, string, string, string] {
  const date = new Date(timestamp * 1000);
  return [
    // Matches the exact original behavior (no explicit options) byte-for-byte, so the
    // common, plenty-of-room case for an old scrobble renders identically to before
    // the relative-time tier existed.
    date.toLocaleString(),
    date.toLocaleString(undefined, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    date.toLocaleString(undefined, {
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    date.toLocaleString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  ];
}

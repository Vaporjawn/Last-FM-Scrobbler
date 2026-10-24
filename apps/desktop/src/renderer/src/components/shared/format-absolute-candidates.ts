/**
 * Formats a Unix-seconds timestamp as four progressively shorter absolute date/time
 * strings in the runtime's default locale: full date and time (the plain
 * `toLocaleString()` output), date and time without seconds, month/day and time without
 * the year, and finally the clock time alone. Used for timestamps a day or more old; see
 * `formatTimestampCandidates` for how the tiers are chosen and consumed.
 */
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

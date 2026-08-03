/**
 * Renders `timestamp` (Unix seconds) as a series of progressively shorter, always
 * fully-formed strings — never a mid-character truncation — for
 * `PlaybackStatusChip`'s `useShrinkToFitIndex`-driven label to step through as its
 * available width shrinks: full date+time with seconds, then without seconds, then
 * without the year, then time only. Ordered longest-first (index 0) to shortest-last,
 * matching `useShrinkToFitIndex`'s own indexing.
 *
 * Locale-aware the same way the single `toLocaleString()` call this replaces already
 * was — `undefined` as the first `toLocaleString()` argument means "use the runtime's
 * own default locale," not a hardcoded one, for every candidate here too.
 */
export function formatTimestampCandidates(
  timestamp: number,
): readonly [full: string, noSeconds: string, noYear: string, timeOnly: string] {
  const date = new Date(timestamp * 1000);

  return [
    // Matches the exact previous behavior (no explicit options) byte-for-byte, so the
    // common, plenty-of-room case renders identically to before this existed.
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

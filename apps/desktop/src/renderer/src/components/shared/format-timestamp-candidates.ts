const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

/**
 * The widest string this module's *terse* (last, most-abbreviated) candidate can
 * realistically produce, in `ch` units (roughly one digit's width in the current
 * font) — `TimestampLabel` reserves this much width up front via CSS `minWidth`
 * rather than starting at zero and only reacting after the fact once
 * `useShrinkToFitIndex` detects real overflow. A guaranteed floor, not a cap: the chip
 * can still render wider (its full, most-detailed candidate) whenever a row actually
 * has the room.
 *
 * Measured directly, not guessed: the relative tier's terse candidates ("Just now"
 * aside, which only ever occupies the three *non*-terse slots) top out at 3 characters
 * ("23h"/"59m"); the absolute tier's terse candidate — a bare
 * `date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" })` clock time
 * — measured 8 characters for every hour/minute combination on this project's `en-US`
 * development locale (e.g. `"12:05 AM"`, `"11:59 PM"`) — see the exhaustive sweep in
 * `format-timestamp-candidates.test.ts`. Set to 9, one character of headroom above
 * that measured 8, for locales this project hasn't explicitly verified against (a
 * narrow no-break space between the time and day-period marker, a longer day-period
 * word, etc.) — an honest safety margin, not a proof those locales were checked.
 */
export const TIMESTAMP_CHIP_MIN_WIDTH_CHARS = 9;

/**
 * Renders `timestamp` (Unix seconds) as a series of progressively shorter, always
 * fully-formed strings — never a mid-character truncation — for
 * `PlaybackStatusChip`'s `useShrinkToFitIndex`-driven label to step through as its
 * available width shrinks.
 *
 * Two entirely different candidate sets depending on how long ago `timestamp` was,
 * relative to `now`:
 *
 * - **Within the last 24 hours**: relative "time ago" phrasing, standardized on one
 *   consistent shape — "6h ago"/"5m ago" — rather than stepping through multiple
 *   differently-worded lengths ("6 hours ago" → "6 hr ago" → "6h ago"). The unit
 *   abbreviation is already about as short as this can usefully get while still
 *   reading as a sentence, so there's nothing meaningfully shorter to shrink through
 *   until the bare "6h"/"5m" terse fallback — same shape as "Just now" → "Now".
 *   Real bug this tier fixes (independent of the standardization above): the old
 *   absolute-only system bottomed out at a fixed-width clock time ("12:22 PM") with
 *   no shorter fallback below it — a double-digit hour is exactly one character
 *   longer than a single-digit one, and in a chip sized with essentially zero slack
 *   (tuned for the common "1:06 PM" case), that one extra character was enough to
 *   overflow and fall through to `TimestampLabel`'s CSS `text-overflow: ellipsis`
 *   last resort on *every* double-digit-hour scrobble — visible in production as
 *   "12:22 …" for a plain, unremarkable timestamp that was never actually too long
 *   to show in full.
 * - **A day or older**: the original four-tier absolute date/time breakdown — full
 *   date+time with seconds, then without seconds, then without the year, then time
 *   only.
 *
 * Locale-aware the same way the single `toLocaleString()` call the absolute tiers
 * originally replaced already was — `undefined` as `toLocaleString`'s first argument
 * means "use the runtime's own default locale," not a hardcoded one. The relative
 * candidates are deliberately plain English rather than routed through
 * `Intl.RelativeTimeFormat`: `Intl`'s own output ("5 minutes ago") is more verbose
 * than this needs and has no built-in "6h ago"-style abbreviation, so both tiers are
 * hand-written to stay consistent with each other.
 *
 * @param now Unix milliseconds to measure "how long ago" against — defaults to
 * `Date.now()` for real call sites; tests pass a fixed value instead so they aren't
 * dependent on the actual wall-clock time the suite happens to run at.
 */
export function formatTimestampCandidates(
  timestamp: number,
  now: number = Date.now(),
): readonly [mostDetailed: string, detailed: string, brief: string, terse: string] {
  // Clamped to 0, not left negative — a `timestamp` very slightly in the future
  // (clock skew between this machine and Last.fm's server, or between this hook's
  // `now` and the instant `timestamp` was recorded) should still read as "Just now"
  // rather than a nonsensical negative "ago".
  const elapsedMs = Math.max(0, now - timestamp * 1000);
  return elapsedMs < ONE_DAY_MS
    ? formatRelativeCandidates(elapsedMs)
    : formatAbsoluteCandidates(timestamp);
}

function formatRelativeCandidates(elapsedMs: number): readonly [string, string, string, string] {
  if (elapsedMs < ONE_MINUTE_MS) {
    return ["Just now", "Just now", "Just now", "Now"];
  }
  if (elapsedMs < ONE_HOUR_MS) {
    const minutes = Math.floor(elapsedMs / ONE_MINUTE_MS);
    // Same standardized "6h ago" shape as the hour tier below, not a shrinking ladder
    // of differently-worded lengths — see this function's docstring.
    const label = `${minutes}m ago`;
    return [label, label, label, `${minutes}m`];
  }
  const hours = Math.floor(elapsedMs / ONE_HOUR_MS);
  const label = `${hours}h ago`;
  return [label, label, label, `${hours}h`];
}

function formatAbsoluteCandidates(timestamp: number): readonly [string, string, string, string] {
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

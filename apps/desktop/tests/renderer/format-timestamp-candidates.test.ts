import { describe, expect, it } from "vitest";
import {
  formatTimestampCandidates,
  TIMESTAMP_CHIP_MIN_WIDTH_CHARS,
} from "../../src/renderer/src/components/shared/format-timestamp-candidates.js";

describe("formatTimestampCandidates", () => {
  describe("a day or older (absolute date/time candidates)", () => {
    // A fixed, known instant rather than `Date.now()` — every candidate below is
    // asserted against the exact `Intl`-formatted string for *this specific* date, not
    // just checked for the presence/absence of a substring, so a wrong `options`
    // object (wrong field, wrong "2-digit" vs "numeric") would actually fail the test.
    const TIMESTAMP = Math.floor(new Date(2026, 7, 3, 14, 45, 30).getTime() / 1000);
    const DATE = new Date(TIMESTAMP * 1000);
    // Explicit, far-future `now` (2 days later) — not the default `Date.now()` —
    // so these tests deterministically exercise the absolute-candidate branch
    // regardless of what the real wall-clock date happens to be when the suite runs
    // (TIMESTAMP above is a fixed calendar date, not relative to "today").
    const NOW = TIMESTAMP * 1000 + 2 * 24 * 60 * 60 * 1000;

    it("the first candidate matches Date.prototype.toLocaleString() with no options, unchanged from before relative candidates existed", () => {
      const [full] = formatTimestampCandidates(TIMESTAMP, NOW);

      expect(full).toBe(DATE.toLocaleString());
    });

    it("the second candidate drops seconds but keeps the year", () => {
      const [, noSeconds] = formatTimestampCandidates(TIMESTAMP, NOW);

      expect(noSeconds).toBe(
        DATE.toLocaleString(undefined, {
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      );
      expect(noSeconds).not.toContain(":30");
    });

    it("the third candidate drops the year but keeps month/day and time", () => {
      const [, , noYear] = formatTimestampCandidates(TIMESTAMP, NOW);

      expect(noYear).toBe(
        DATE.toLocaleString(undefined, {
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      );
      expect(noYear).not.toContain("2026");
    });

    it("the fourth candidate is time only", () => {
      const [, , , timeOnly] = formatTimestampCandidates(TIMESTAMP, NOW);

      expect(timeOnly).toBe(DATE.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" }));
      expect(timeOnly).not.toContain("2026");
      expect(timeOnly).not.toContain("8/3");
    });

    it("each candidate is strictly shorter than (or equal to, locale-dependent) the one before it", () => {
      const candidates = formatTimestampCandidates(TIMESTAMP, NOW);

      for (let i = 1; i < candidates.length; i += 1) {
        expect(candidates[i]?.length).toBeLessThanOrEqual(candidates[i - 1]?.length ?? Infinity);
      }
    });

    it("treats exactly 24 hours ago as 'a day or older', not relative", () => {
      const exactlyOneDayLater = TIMESTAMP * 1000 + 24 * 60 * 60 * 1000;

      const [full] = formatTimestampCandidates(TIMESTAMP, exactlyOneDayLater);

      expect(full).toBe(DATE.toLocaleString());
    });
  });

  describe("within the last 24 hours (relative 'time ago' candidates)", () => {
    // Regression coverage: this tier is what actually fixes the real production bug —
    // the old absolute-only system bottomed out at a fixed-width clock time
    // ("12:22 PM") with nothing shorter to fall back to, so a double-digit hour (one
    // character longer than a single-digit one) silently overflowed a tightly-sized
    // chip into CSS ellipsis truncation. These short "ago" forms give the shrink-to-fit
    // system genuinely short fallbacks to step down into instead.
    const NOW = new Date(2026, 7, 3, 14, 45, 30).getTime();

    function secondsAgo(seconds: number): number {
      return Math.floor((NOW - seconds * 1000) / 1000);
    }

    it("shows 'Just now' for anything under a minute old, all the way down to a bare 'Now'", () => {
      const candidates = formatTimestampCandidates(secondsAgo(30), NOW);

      expect(candidates).toEqual(["Just now", "Just now", "Just now", "Now"]);
    });

    it("clamps a timestamp slightly in the future (clock skew) to 'Just now' rather than a negative duration", () => {
      const candidates = formatTimestampCandidates(secondsAgo(-5), NOW);

      expect(candidates).toEqual(["Just now", "Just now", "Just now", "Now"]);
    });

    it("shows the standardized 'Xm ago' shape, down to a bare 'Xm', for anything under an hour old", () => {
      const candidates = formatTimestampCandidates(secondsAgo(5 * 60), NOW);

      expect(candidates).toEqual(["5m ago", "5m ago", "5m ago", "5m"]);
    });

    it("standardizes on 'Xm ago' for exactly one minute too — no singular/plural wording to get wrong", () => {
      const candidates = formatTimestampCandidates(secondsAgo(60), NOW);

      expect(candidates).toEqual(["1m ago", "1m ago", "1m ago", "1m"]);
    });

    it("shows the standardized 'Xh ago' shape, down to a bare 'Xh', for anything under a day old", () => {
      const candidates = formatTimestampCandidates(secondsAgo(3 * 60 * 60), NOW);

      expect(candidates).toEqual(["3h ago", "3h ago", "3h ago", "3h"]);
    });

    it("standardizes on 'Xh ago' for exactly one hour too — no singular/plural wording to get wrong", () => {
      const candidates = formatTimestampCandidates(secondsAgo(60 * 60), NOW);

      expect(candidates).toEqual(["1h ago", "1h ago", "1h ago", "1h"]);
    });

    it("every candidate is strictly shorter than (or equal to) the one before it", () => {
      for (const seconds of [30, 5 * 60, 3 * 60 * 60]) {
        const candidates = formatTimestampCandidates(secondsAgo(seconds), NOW);
        for (let i = 1; i < candidates.length; i += 1) {
          expect(candidates[i]?.length).toBeLessThanOrEqual(candidates[i - 1]?.length ?? Infinity);
        }
      }
    });

    // Exhaustive sweep, not just a few hand-picked samples: every whole minute in the
    // 24-hour window `formatTimestampCandidates` can actually be asked to render a
    // relative candidate for. This is what "confirm it's actually catching everything"
    // means in a way jsdom can genuinely prove — it can't measure real pixel layout
    // (see `use-shrink-to-fit-index.test.tsx` and this project's docs for why), but it
    // absolutely can enumerate every value the *string-producing* logic will ever see
    // and check each one against the real rules, rather than trusting a handful of
    // spot checks to represent the whole space.
    describe("exhaustive sweep across every minute of the 24-hour relative window", () => {
      for (let minute = 0; minute < 24 * 60; minute += 1) {
        it(`minute ${minute} (${Math.floor(minute / 60)}h${minute % 60}m ago) resolves to the correct tier and shape`, () => {
          const candidates = formatTimestampCandidates(secondsAgo(minute * 60), NOW);

          if (minute === 0) {
            expect(candidates).toEqual(["Just now", "Just now", "Just now", "Now"]);
          } else if (minute < 60) {
            expect(candidates).toEqual([
              `${minute}m ago`,
              `${minute}m ago`,
              `${minute}m ago`,
              `${minute}m`,
            ]);
          } else {
            const hours = Math.floor(minute / 60);
            expect(candidates).toEqual([`${hours}h ago`, `${hours}h ago`, `${hours}h ago`, `${hours}h`]);
          }

          // The property every candidate must hold regardless of tier: never longer
          // than the one before it, and the terse (last) candidate always small enough
          // to fit the chip's reserved minimum width — this is the same guarantee
          // `TimestampLabel`'s `minWidth` (see `format-timestamp-candidates.ts`) relies
          // on to promise the chip never has to fall back to real CSS ellipsis
          // truncation for anything in this 24-hour relative window.
          for (let i = 1; i < candidates.length; i += 1) {
            expect(candidates[i]?.length).toBeLessThanOrEqual(candidates[i - 1]?.length ?? Infinity);
          }
          // Literal index 3 (not a loop variable) resolves to plain `string` on this
          // known 4-tuple return type, even under `noUncheckedIndexedAccess` — no `?.`
          // needed here, unlike the loop above indexing by a non-literal `i`.
          expect(candidates[3].length).toBeLessThanOrEqual(TIMESTAMP_CHIP_MIN_WIDTH_CHARS);
        });
      }
    });
  });

  describe("TIMESTAMP_CHIP_MIN_WIDTH_CHARS covers every candidate this module can produce", () => {
    // `TimestampLabel` reserves `TIMESTAMP_CHIP_MIN_WIDTH_CHARS` of width up front (see
    // its own docstring) specifically so the chip never has to shrink below a
    // guaranteed-to-fit floor. That promise is only as good as this constant actually
    // being >= the widest string this module can produce for the tier the floor is
    // meant to cover — the *terse* (last) relative candidate, and the *terse* absolute
    // candidate (a bare locale clock time), since those are what the chip falls back to
    // when a row is tight. This test sweeps the realistic input space for both and
    // fails loudly if a future change (e.g. a locale/format tweak) ever produces
    // something wider than the reserved floor, instead of silently letting it truncate
    // in production.
    it("every relative terse candidate (0–1439 minutes ago) fits within the reserved width", () => {
      const now = new Date(2026, 7, 3, 14, 45, 30).getTime();

      for (let minute = 0; minute < 24 * 60; minute += 1) {
        const timestamp = Math.floor((now - minute * 60 * 1000) / 1000);
        const [, , , terse] = formatTimestampCandidates(timestamp, now);

        expect(terse.length).toBeLessThanOrEqual(TIMESTAMP_CHIP_MIN_WIDTH_CHARS);
      }
    });

    it("every absolute terse candidate (every hour, on the current locale's clock format) fits within the reserved width", () => {
      // Only hour and minute feed the terse absolute candidate (see
      // `formatAbsoluteCandidates`) — the date portion doesn't affect it, so sweeping
      // every hour of a day at a couple of different minute values covers every string
      // shape this locale can produce for it (single- vs. double-digit hour, and
      // whichever day-period marker the runtime's locale uses).
      const dayOldMs = 2 * 24 * 60 * 60 * 1000;

      for (let hour = 0; hour < 24; hour += 1) {
        for (const minute of [0, 5, 45]) {
          const date = new Date(2026, 7, 3, hour, minute, 0);
          const timestamp = Math.floor(date.getTime() / 1000);
          const now = date.getTime() + dayOldMs;
          const [, , , terse] = formatTimestampCandidates(timestamp, now);

          expect(terse.length).toBeLessThanOrEqual(TIMESTAMP_CHIP_MIN_WIDTH_CHARS);
        }
      }
    });
  });
});

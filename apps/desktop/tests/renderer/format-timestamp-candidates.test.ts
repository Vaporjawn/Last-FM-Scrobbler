import { describe, expect, it } from "vitest";
import { formatTimestampCandidates } from "../../src/renderer/src/components/shared/format-timestamp-candidates.js";

describe("formatTimestampCandidates", () => {
  // A fixed, known instant rather than `Date.now()` — every candidate below is
  // asserted against the exact `Intl`-formatted string for *this specific* date, not
  // just checked for the presence/absence of a substring, so a wrong `options` object
  // (wrong field, wrong "2-digit" vs "numeric") would actually fail the test.
  const TIMESTAMP = Math.floor(new Date(2026, 7, 3, 14, 45, 30).getTime() / 1000);
  const DATE = new Date(TIMESTAMP * 1000);

  it("the first candidate matches Date.prototype.toLocaleString() with no options, unchanged from before this existed", () => {
    const [full] = formatTimestampCandidates(TIMESTAMP);

    expect(full).toBe(DATE.toLocaleString());
  });

  it("the second candidate drops seconds but keeps the year", () => {
    const [, noSeconds] = formatTimestampCandidates(TIMESTAMP);

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
    const [, , noYear] = formatTimestampCandidates(TIMESTAMP);

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
    const [, , , timeOnly] = formatTimestampCandidates(TIMESTAMP);

    expect(timeOnly).toBe(DATE.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" }));
    expect(timeOnly).not.toContain("2026");
    expect(timeOnly).not.toContain("8/3");
  });

  it("each candidate is strictly shorter than (or equal to, locale-dependent) the one before it", () => {
    const candidates = formatTimestampCandidates(TIMESTAMP);

    for (let i = 1; i < candidates.length; i += 1) {
      expect(candidates[i]?.length).toBeLessThanOrEqual(candidates[i - 1]?.length ?? Infinity);
    }
  });
});

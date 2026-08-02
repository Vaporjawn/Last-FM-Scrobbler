import { describe, expect, it } from "vitest";
import { isEligibleForScrobble } from "../../src/rules/is-eligible-for-scrobble.js";

describe("isEligibleForScrobble", () => {
  it("rejects tracks shorter than 30 seconds even if fully played", () => {
    expect(isEligibleForScrobble({ durationSec: 20, playedSec: 20 })).toBe(false);
  });

  it("rejects a long track played less than 50% and less than 240s", () => {
    expect(isEligibleForScrobble({ durationSec: 600, playedSec: 100 })).toBe(false);
  });

  it("accepts a long track once played past the 50% mark", () => {
    expect(isEligibleForScrobble({ durationSec: 600, playedSec: 300 })).toBe(true);
  });

  it("accepts a very long track once played past 240s, even under 50%", () => {
    expect(isEligibleForScrobble({ durationSec: 1200, playedSec: 240 })).toBe(true);
  });

  it("rejects a very long track played past 50%-irrelevant point but under 240s", () => {
    expect(isEligibleForScrobble({ durationSec: 1200, playedSec: 239 })).toBe(false);
  });

  it("accepts a short-but-valid track exactly at its 50% mark", () => {
    expect(isEligibleForScrobble({ durationSec: 60, playedSec: 30 })).toBe(true);
  });

  it("falls back to the 240s cap alone when duration is unknown (e.g. a live stream)", () => {
    expect(isEligibleForScrobble({ playedSec: 239 })).toBe(false);
    expect(isEligibleForScrobble({ playedSec: 240 })).toBe(true);
  });
});

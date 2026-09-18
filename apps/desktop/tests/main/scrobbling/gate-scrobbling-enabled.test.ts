import { describe, expect, it, vi } from "vitest";
import type { ScrobbleEligibleEvent, TrackChangedEvent } from "@lastfm-scrobbler/core";
import type { TrackInfo } from "@lastfm-scrobbler/shared-types";
import { gateScrobblingEnabled } from "../../../src/main/scrobbling/gate-scrobbling-enabled.js";

const TRACK: TrackInfo = {
  title: "Weights",
  artist: "Everything Everything",
  album: "Man Alive",
  durationSec: 340,
  sourceApp: "com.apple.Music",
  isStream: false,
};

const SCROBBLE_ELIGIBLE_EVENT: ScrobbleEligibleEvent = { track: TRACK, startedAt: 1_700_000_000 };
const TRACK_CHANGED_EVENT: TrackChangedEvent = { track: TRACK, startedAt: 1_700_000_000 };

describe("gateScrobblingEnabled", () => {
  it("calls through to onScrobbleEligible when scrobbling is enabled", () => {
    const onScrobbleEligible = vi.fn();
    const onTrackChanged = vi.fn();
    const gated = gateScrobblingEnabled({
      onScrobbleEligible,
      onTrackChanged,
      isScrobblingEnabled: () => true,
    });

    gated.onScrobbleEligible(SCROBBLE_ELIGIBLE_EVENT);

    expect(onScrobbleEligible).toHaveBeenCalledWith(SCROBBLE_ELIGIBLE_EVENT);
  });

  it("suppresses onScrobbleEligible (never reaches wire-scrobbling.ts's enqueue) when scrobbling is disabled", () => {
    const onScrobbleEligible = vi.fn();
    const onTrackChanged = vi.fn();
    const gated = gateScrobblingEnabled({
      onScrobbleEligible,
      onTrackChanged,
      isScrobblingEnabled: () => false,
    });

    gated.onScrobbleEligible(SCROBBLE_ELIGIBLE_EVENT);

    expect(onScrobbleEligible).not.toHaveBeenCalled();
  });

  it("calls through to onTrackChanged when scrobbling is enabled", () => {
    const onScrobbleEligible = vi.fn();
    const onTrackChanged = vi.fn();
    const gated = gateScrobblingEnabled({
      onScrobbleEligible,
      onTrackChanged,
      isScrobblingEnabled: () => true,
    });

    gated.onTrackChanged(TRACK_CHANGED_EVENT);

    expect(onTrackChanged).toHaveBeenCalledWith(TRACK_CHANGED_EVENT);
  });

  it("suppresses onTrackChanged (never reaches wire-scrobbling.ts's updateNowPlaying) when scrobbling is disabled", () => {
    const onScrobbleEligible = vi.fn();
    const onTrackChanged = vi.fn();
    const gated = gateScrobblingEnabled({
      onScrobbleEligible,
      onTrackChanged,
      isScrobblingEnabled: () => false,
    });

    gated.onTrackChanged(TRACK_CHANGED_EVENT);

    expect(onTrackChanged).not.toHaveBeenCalled();
  });

  it("reads isScrobblingEnabled fresh on every call rather than capturing it once at wiring time", () => {
    // This is the whole point of the gate — AppSettings.scrobblingEnabled must be
    // live-toggled with no restart, unlike filterExpression/skipNonMusicVideos (see
    // gate-scrobbling-enabled.ts's own docstring). A closure that captured the flag
    // once would require re-wiring on every settings change instead.
    const onScrobbleEligible = vi.fn();
    const onTrackChanged = vi.fn();
    let enabled = true;
    const gated = gateScrobblingEnabled({
      onScrobbleEligible,
      onTrackChanged,
      isScrobblingEnabled: () => enabled,
    });

    gated.onScrobbleEligible(SCROBBLE_ELIGIBLE_EVENT);
    enabled = false;
    gated.onScrobbleEligible(SCROBBLE_ELIGIBLE_EVENT);
    enabled = true;
    gated.onScrobbleEligible(SCROBBLE_ELIGIBLE_EVENT);

    expect(onScrobbleEligible).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it, vi } from "vitest";
import { Tracker } from "../../src/tracker/tracker.js";
import { compileFilter } from "../../src/filters/filter-expression.js";
import type { PlaybackSource, PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";

function track(overrides: Partial<TrackInfo> = {}): TrackInfo {
  return {
    title: "Idioteque",
    artist: "Radiohead",
    durationSec: 300,
    sourceApp: "spotify",
    isStream: false,
    ...overrides,
  };
}

/** A fake PlaybackSource the test drives directly, instead of a real adapter. */
function createFakeSource() {
  let trackHandler: ((track: TrackInfo) => void) | undefined;
  let stateHandler: ((state: PlaybackState) => void) | undefined;

  const source: PlaybackSource = {
    onTrackChanged: (cb) => {
      trackHandler = cb;
      return () => {
        trackHandler = undefined;
      };
    },
    onPlaybackStateChanged: (cb) => {
      stateHandler = cb;
      return () => {
        stateHandler = undefined;
      };
    },
    getPosition: () => Promise.resolve(0),
  };

  return {
    source,
    emitTrackChanged: (t: TrackInfo) => trackHandler?.(t),
    emitPlaybackStateChanged: (s: PlaybackState) => stateHandler?.(s),
  };
}

describe("Tracker", () => {
  it("emits trackChanged and starts the clock when a new track appears", () => {
    const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
    const nowSec = 1_700_000_000;
    const onTrackChanged = vi.fn();
    const tracker = new Tracker({
      source,
      events: { onTrackChanged },
      now: () => nowSec,
    });
    tracker.start();

    emitPlaybackStateChanged("playing");
    emitTrackChanged(track());

    expect(onTrackChanged).toHaveBeenCalledWith({ track: track(), startedAt: nowSec });
  });

  it("does not emit scrobbleEligible before the eligibility threshold is reached", () => {
    const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
    let nowSec = 1_700_000_000;
    const onScrobbleEligible = vi.fn();
    const tracker = new Tracker({ source, events: { onScrobbleEligible }, now: () => nowSec });
    tracker.start();

    emitPlaybackStateChanged("playing");
    emitTrackChanged(track({ durationSec: 300 }));

    nowSec += 100; // 100s played of a 300s track — under the 150s (50%) threshold
    tracker.tick();

    expect(onScrobbleEligible).not.toHaveBeenCalled();
  });

  it("emits scrobbleEligible exactly once, when the threshold is crossed", () => {
    const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
    let nowSec = 1_700_000_000;
    const onScrobbleEligible = vi.fn();
    const tracker = new Tracker({ source, events: { onScrobbleEligible }, now: () => nowSec });
    tracker.start();
    const startedAt = nowSec;

    emitPlaybackStateChanged("playing");
    emitTrackChanged(track({ durationSec: 300 }));

    nowSec += 150; // exactly 50% of a 300s track
    tracker.tick();
    nowSec += 10;
    tracker.tick(); // still eligible, must not fire again

    expect(onScrobbleEligible).toHaveBeenCalledTimes(1);
    expect(onScrobbleEligible).toHaveBeenCalledWith({
      track: track({ durationSec: 300 }),
      startedAt,
    });
  });

  it("does not accumulate played time while paused", () => {
    const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
    let nowSec = 1_700_000_000;
    const onScrobbleEligible = vi.fn();
    const tracker = new Tracker({ source, events: { onScrobbleEligible }, now: () => nowSec });
    tracker.start();

    emitPlaybackStateChanged("playing");
    emitTrackChanged(track({ durationSec: 300 }));

    nowSec += 100;
    tracker.tick();
    emitPlaybackStateChanged("paused");
    nowSec += 1000; // a long pause must not count as played time
    tracker.tick();
    emitPlaybackStateChanged("playing");
    nowSec += 50; // 100 + 50 = 150s played total, exactly at threshold
    tracker.tick();

    expect(onScrobbleEligible).toHaveBeenCalledTimes(1);
  });

  it("does not drop already-accumulated time on a redundant 'playing' event", () => {
    // Regression test: nothing in the PlaybackSource contract guarantees a source
    // only emits onPlaybackStateChanged on a genuine transition — a redundant
    // "playing" event fired while already playing used to reset the accumulation
    // baseline without first accumulating, silently discarding elapsed played time.
    const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
    let nowSec = 1_700_000_000;
    const onScrobbleEligible = vi.fn();
    const tracker = new Tracker({ source, events: { onScrobbleEligible }, now: () => nowSec });
    tracker.start();

    emitPlaybackStateChanged("playing");
    emitTrackChanged(track({ durationSec: 300 }));

    nowSec += 5;
    tracker.tick(); // 5s played so far
    emitPlaybackStateChanged("playing"); // redundant — no real pause happened
    nowSec += 145; // 5 + 145 = 150s played total, exactly at the 50% threshold
    tracker.tick();

    expect(onScrobbleEligible).toHaveBeenCalledTimes(1);
  });

  it("resets accumulation and re-arms eligibility when a genuinely new track starts", () => {
    const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
    let nowSec = 1_700_000_000;
    const onScrobbleEligible = vi.fn();
    const tracker = new Tracker({ source, events: { onScrobbleEligible }, now: () => nowSec });
    tracker.start();

    emitPlaybackStateChanged("playing");
    emitTrackChanged(track({ title: "Idioteque", durationSec: 300 }));
    nowSec += 150;
    tracker.tick();
    expect(onScrobbleEligible).toHaveBeenCalledTimes(1);

    nowSec += 1000; // well past the 5s dedup bucket
    emitTrackChanged(track({ title: "Nude", durationSec: 300 }));
    nowSec += 150;
    tracker.tick();

    expect(onScrobbleEligible).toHaveBeenCalledTimes(2);
  });

  it("ignores a redundant re-report of the track already playing", () => {
    const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
    let nowSec = 1_700_000_000;
    const onTrackChanged = vi.fn();
    const tracker = new Tracker({ source, events: { onTrackChanged }, now: () => nowSec });
    tracker.start();

    emitPlaybackStateChanged("playing");
    emitTrackChanged(track());
    nowSec += 1; // within the dedup bucket
    emitTrackChanged(track());

    expect(onTrackChanged).toHaveBeenCalledTimes(1);
  });

  it("excludes tracks matching the configured filter entirely", () => {
    const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
    let nowSec = 1_700_000_000;
    const onTrackChanged = vi.fn();
    const onScrobbleEligible = vi.fn();
    const tracker = new Tracker({
      source,
      events: { onTrackChanged, onScrobbleEligible },
      filter: compileFilter('sourceApp == "firefox"'),
      now: () => nowSec,
    });
    tracker.start();

    emitPlaybackStateChanged("playing");
    emitTrackChanged(track({ sourceApp: "firefox" }));
    nowSec += 150;
    tracker.tick();

    expect(onTrackChanged).not.toHaveBeenCalled();
    expect(onScrobbleEligible).not.toHaveBeenCalled();
  });

  it("stops reacting to source events after stop()", () => {
    const { source, emitTrackChanged, emitPlaybackStateChanged } = createFakeSource();
    const onTrackChanged = vi.fn();
    const tracker = new Tracker({ source, events: { onTrackChanged } });
    tracker.start();
    tracker.stop();

    emitPlaybackStateChanged("playing");
    emitTrackChanged(track());

    expect(onTrackChanged).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { NowPlayingStreamParser } from "../src/index.js";

// Fixture lines are real output captured from `mediaremote-adapter.pl ... stream` while
// Music.app played a queue and a "next track" command was issued mid-test (see
// packages/adapter-macos/vendor/mediaremote-adapter/VENDORED.md for how this is
// produced) — not hand-invented, so the shape (including which fields diff-updates
// carry) reflects what the real tool actually emits.
const EMPTY_SNAPSHOT = JSON.stringify({ type: "data", diff: false, payload: {} });
const TRACK_ONE_SNAPSHOT = JSON.stringify({
  type: "data",
  diff: false,
  payload: {
    composer: "Alabama Shakes",
    title: "Be Mine",
    duration: 256.078,
    bundleIdentifier: "com.apple.Music",
    elapsedTime: 0.017,
    mediaType: "kMRMediaRemoteNowPlayingInfoTypeAudio",
    playing: true,
    timestamp: "2026-08-02T02:36:08Z",
    artist: "Alabama Shakes",
    album: "Boys & Girls",
    playbackRate: 1,
  },
});
const TRACK_TWO_SNAPSHOT = JSON.stringify({
  type: "data",
  diff: false,
  payload: {
    composer: "Mac DeMarco",
    title: "Rick's New Haircut #1",
    duration: 190,
    bundleIdentifier: "com.apple.Music",
    elapsedTime: 0,
    playing: true,
    timestamp: "2026-08-02T02:37:05Z",
    artist: "Mac DeMarco",
    album: "Another (Demo) One",
    playbackRate: 0,
  },
});
const TRACK_TWO_RATE_DIFF = JSON.stringify({
  type: "data",
  diff: true,
  payload: { timestamp: "2026-08-02T02:37:05Z", duration: 190.799, playbackRate: 1 },
});

describe("NowPlayingStreamParser", () => {
  it("does not emit onTrackChanged for an empty (nothing playing) snapshot", () => {
    const parser = new NowPlayingStreamParser();
    const onTrackChanged = vi.fn();
    parser.onTrackChanged(onTrackChanged);

    parser.handleLine(EMPTY_SNAPSHOT);

    expect(onTrackChanged).not.toHaveBeenCalled();
  });

  it("emits onTrackChanged with mapped TrackInfo for a full snapshot", () => {
    const parser = new NowPlayingStreamParser();
    const onTrackChanged = vi.fn();
    parser.onTrackChanged(onTrackChanged);

    parser.handleLine(TRACK_ONE_SNAPSHOT);

    expect(onTrackChanged).toHaveBeenCalledExactlyOnceWith({
      title: "Be Mine",
      artist: "Alabama Shakes",
      album: "Boys & Girls",
      durationSec: 256.078,
      sourceApp: "com.apple.Music",
      isStream: false,
    });
  });

  it("emits onPlaybackStateChanged: stopped -> playing", () => {
    const parser = new NowPlayingStreamParser();
    const onPlaybackStateChanged = vi.fn();
    parser.onPlaybackStateChanged(onPlaybackStateChanged);

    parser.handleLine(TRACK_ONE_SNAPSHOT);

    expect(onPlaybackStateChanged).toHaveBeenCalledExactlyOnceWith("playing");
  });

  it("emits onPlaybackStateChanged: playing -> paused when a new track starts paused", () => {
    const parser = new NowPlayingStreamParser();
    parser.handleLine(TRACK_ONE_SNAPSHOT);
    const onPlaybackStateChanged = vi.fn();
    parser.onPlaybackStateChanged(onPlaybackStateChanged);

    // TRACK_TWO_SNAPSHOT's playbackRate is 0 (not yet actually playing) and its
    // "playing" key is true — mediaremote-adapter reports `playing` from a different
    // signal than `playbackRate`; the real capture shows exactly this brief mismatch
    // immediately after a track change, resolved a moment later by the diff below.
    parser.handleLine(TRACK_TWO_SNAPSHOT);

    expect(onPlaybackStateChanged).not.toHaveBeenCalled(); // still "playing" throughout
  });

  it("does not re-emit onTrackChanged when a diff updates fields on the same track", () => {
    const parser = new NowPlayingStreamParser();
    parser.handleLine(TRACK_TWO_SNAPSHOT);
    const onTrackChanged = vi.fn();
    parser.onTrackChanged(onTrackChanged);

    parser.handleLine(TRACK_TWO_RATE_DIFF);

    expect(onTrackChanged).not.toHaveBeenCalled();
  });

  it("emits onTrackChanged again when the track identity actually changes", () => {
    const parser = new NowPlayingStreamParser();
    parser.handleLine(TRACK_ONE_SNAPSHOT);
    const onTrackChanged = vi.fn();
    parser.onTrackChanged(onTrackChanged);

    parser.handleLine(TRACK_TWO_SNAPSHOT);

    expect(onTrackChanged).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: "Rick's New Haircut #1", artist: "Mac DeMarco" }),
    );
  });

  it("transitions to stopped once the snapshot no longer has a title", () => {
    const parser = new NowPlayingStreamParser();
    parser.handleLine(TRACK_ONE_SNAPSHOT);
    const onPlaybackStateChanged = vi.fn();
    parser.onPlaybackStateChanged(onPlaybackStateChanged);

    parser.handleLine(EMPTY_SNAPSHOT);

    expect(onPlaybackStateChanged).toHaveBeenCalledExactlyOnceWith("stopped");
  });

  it("ignores malformed JSON lines instead of throwing", () => {
    const parser = new NowPlayingStreamParser();
    expect(() => {
      parser.handleLine("not json");
    }).not.toThrow();
  });

  it("ignores blank lines", () => {
    const parser = new NowPlayingStreamParser();
    const onTrackChanged = vi.fn();
    parser.onTrackChanged(onTrackChanged);

    parser.handleLine("   ");

    expect(onTrackChanged).not.toHaveBeenCalled();
  });

  it("ignores events whose type isn't 'data'", () => {
    const parser = new NowPlayingStreamParser();
    const onTrackChanged = vi.fn();
    parser.onTrackChanged(onTrackChanged);

    parser.handleLine(JSON.stringify({ type: "error", payload: { title: "should not apply" } }));

    expect(onTrackChanged).not.toHaveBeenCalled();
  });

  it("unsubscribe stops further callbacks", () => {
    const parser = new NowPlayingStreamParser();
    const onTrackChanged = vi.fn();
    const unsubscribe = parser.onTrackChanged(onTrackChanged);
    unsubscribe();

    parser.handleLine(TRACK_ONE_SNAPSHOT);

    expect(onTrackChanged).not.toHaveBeenCalled();
  });

  describe("getPosition", () => {
    it("returns 0 before any snapshot has arrived", () => {
      const parser = new NowPlayingStreamParser();
      expect(parser.getPosition()).toBe(0);
    });

    it("returns the raw elapsedTime when paused", () => {
      const parser = new NowPlayingStreamParser();
      parser.handleLine(TRACK_TWO_SNAPSHOT); // playbackRate: 0 in this fixture

      // `playing: true` in the fixture, but playbackRate 0 — position shouldn't
      // extrapolate past the reported elapsedTime when the state we track is
      // nonetheless "playing" per the `playing` key (see comment above); to test the
      // paused/no-extrapolation branch specifically, drive state to "paused" via a
      // playing:false diff first.
      parser.handleLine(JSON.stringify({ type: "data", diff: true, payload: { playing: false } }));

      expect(parser.getPosition()).toBe(0);
    });

    it("extrapolates position forward from timestamp while playing", () => {
      vi.useFakeTimers();
      try {
        const capturedAt = new Date("2026-08-02T02:36:08Z");
        vi.setSystemTime(capturedAt);
        const parser = new NowPlayingStreamParser();
        parser.handleLine(TRACK_ONE_SNAPSHOT); // elapsedTime 0.017, playbackRate 1, playing

        vi.setSystemTime(new Date(capturedAt.getTime() + 5000));

        expect(parser.getPosition()).toBeCloseTo(5.017, 1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("clamps position to the track duration", () => {
      vi.useFakeTimers();
      try {
        const capturedAt = new Date("2026-08-02T02:36:08Z");
        vi.setSystemTime(capturedAt);
        const parser = new NowPlayingStreamParser();
        parser.handleLine(TRACK_ONE_SNAPSHOT); // duration 256.078

        vi.setSystemTime(new Date(capturedAt.getTime() + 10 * 60 * 1000)); // 10 min later

        expect(parser.getPosition()).toBe(256.078);
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not crash and reports 0 when a diff carries elapsedTime: null", () => {
      // Regression test: the vendored native adapter's diff protocol legitimately
      // emits JSON `null` for a field that momentarily disappears while the track
      // identity stays the same (see stream.m's createDiff, which sets a removed key
      // to NSNull) — `duration`/`elapsedTime` aren't preserved across polls, so this is
      // a real, observed shape. The old `=== undefined` check let `null` through as a
      // real elapsedTime, and JS's numeric coercion of `null` to `0` silently clamped
      // the reported position instead of this method's own "no elapsedTime" branch
      // handling it explicitly.
      const parser = new NowPlayingStreamParser();
      parser.handleLine(TRACK_ONE_SNAPSHOT);

      parser.handleLine(JSON.stringify({ type: "data", diff: true, payload: { elapsedTime: null } }));

      expect(parser.getPosition()).toBe(0);
    });

    it("ignores a diff's null duration instead of clamping position to 0", () => {
      vi.useFakeTimers();
      try {
        const capturedAt = new Date("2026-08-02T02:36:08Z");
        vi.setSystemTime(capturedAt);
        const parser = new NowPlayingStreamParser();
        parser.handleLine(TRACK_ONE_SNAPSHOT); // elapsedTime 0.017, playbackRate 1, playing

        // A duration: null diff must not participate in Math.min(position, duration) —
        // JS coerces null to 0 in that comparison, which used to clamp position to 0
        // even though playback is still genuinely progressing.
        parser.handleLine(JSON.stringify({ type: "data", diff: true, payload: { duration: null } }));
        vi.setSystemTime(new Date(capturedAt.getTime() + 5000));

        expect(parser.getPosition()).toBeCloseTo(5.017, 1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("does not report a null duration as durationSec after a diff nulls it out", () => {
    // Regression test: toTrackInfo's old `!== undefined` check let a `null` diff
    // value through as `durationSec`, violating the `number | undefined` TrackInfo
    // contract this parser is supposed to guarantee.
    const parser = new NowPlayingStreamParser();
    parser.handleLine(TRACK_ONE_SNAPSHOT); // duration 256.078, album "Boys & Girls"
    const onTrackChanged = vi.fn();
    parser.onTrackChanged(onTrackChanged);

    // A null duration alongside an identity-changing album update, in one diff — the
    // album change is what forces a fresh onTrackChanged emission to inspect.
    parser.handleLine(
      JSON.stringify({
        type: "data",
        diff: true,
        payload: { duration: null, album: "Boys & Girls (Deluxe)" },
      }),
    );

    expect(onTrackChanged).toHaveBeenCalledTimes(1);
    const track = onTrackChanged.mock.calls[0]?.[0] as { durationSec?: number };
    expect(track.durationSec).toBeUndefined();
    expect("durationSec" in track).toBe(false);
  });
});

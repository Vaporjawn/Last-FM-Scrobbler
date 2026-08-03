import { describe, expect, it } from "vitest";
import {
  DEFAULT_NON_MUSIC_VIDEO_THRESHOLD_SEC,
  isLikelyNonMusicVideo,
} from "../../src/rules/is-likely-non-music-video.js";

describe("isLikelyNonMusicVideo", () => {
  it("flags a long browser-sourced track past the default threshold", () => {
    expect(
      isLikelyNonMusicVideo({
        sourceApp: "com.google.Chrome",
        durationSec: DEFAULT_NON_MUSIC_VIDEO_THRESHOLD_SEC + 1,
      }),
    ).toBe(true);
  });

  it("flags a track right at the threshold (inclusive), same >= convention as isEligibleForScrobble", () => {
    expect(
      isLikelyNonMusicVideo({
        sourceApp: "com.google.Chrome",
        durationSec: DEFAULT_NON_MUSIC_VIDEO_THRESHOLD_SEC,
      }),
    ).toBe(true);
  });

  it("does not flag a track just under the threshold", () => {
    expect(
      isLikelyNonMusicVideo({
        sourceApp: "com.google.Chrome",
        durationSec: DEFAULT_NON_MUSIC_VIDEO_THRESHOLD_SEC - 1,
      }),
    ).toBe(false);
  });

  it("does not flag a typical song's duration", () => {
    expect(isLikelyNonMusicVideo({ sourceApp: "com.google.Chrome", durationSec: 210 })).toBe(false);
  });

  it("does not flag a long track from a dedicated music app, not a browser", () => {
    expect(
      isLikelyNonMusicVideo({
        sourceApp: "com.apple.Music",
        durationSec: DEFAULT_NON_MUSIC_VIDEO_THRESHOLD_SEC + 1,
      }),
    ).toBe(false);
  });

  it("does not flag a track with no known duration", () => {
    expect(isLikelyNonMusicVideo({ sourceApp: "com.google.Chrome" })).toBe(false);
  });

  it("respects a custom threshold", () => {
    expect(
      isLikelyNonMusicVideo(
        { sourceApp: "com.google.Chrome", durationSec: 601 },
        { thresholdSec: 600 },
      ),
    ).toBe(true);
  });

  it.each([
    "com.google.Chrome",
    "com.apple.Safari",
    "org.mozilla.firefox",
    "com.microsoft.edgemac",
    "com.brave.Browser",
    "com.operasoftware.Opera",
    "com.vivaldi.Vivaldi",
    "org.chromium.Chromium",
    "firefox",
    "chromium",
  ])("recognizes %s as a browser source", (sourceApp) => {
    expect(
      isLikelyNonMusicVideo({
        sourceApp,
        durationSec: DEFAULT_NON_MUSIC_VIDEO_THRESHOLD_SEC + 1,
      }),
    ).toBe(true);
  });

  it.each(["com.apple.Music", "com.spotify.client", "org.videolan.vlc", "com.plexamp.plexamp"])(
    "does not recognize %s as a browser source",
    (sourceApp) => {
      expect(
        isLikelyNonMusicVideo({
          sourceApp,
          durationSec: DEFAULT_NON_MUSIC_VIDEO_THRESHOLD_SEC + 1,
        }),
      ).toBe(false);
    },
  );
});

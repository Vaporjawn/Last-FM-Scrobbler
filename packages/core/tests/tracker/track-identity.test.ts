import { describe, expect, it } from "vitest";
import { computeTrackIdentity } from "../../src/tracker/track-identity.js";
import type { TrackInfo } from "@lastfm-scrobbler/shared-types";

function track(overrides: Partial<TrackInfo> = {}): TrackInfo {
  return {
    title: "Idioteque",
    artist: "Radiohead",
    sourceApp: "spotify",
    isStream: false,
    ...overrides,
  };
}

describe("computeTrackIdentity", () => {
  it("is stable for the exact same track and start time", () => {
    const a = computeTrackIdentity(track(), 1_700_000_000);
    const b = computeTrackIdentity(track(), 1_700_000_000);
    expect(a).toBe(b);
  });

  it("is case- and whitespace-insensitive for artist/title/album", () => {
    const a = computeTrackIdentity(
      track({ artist: "Radiohead", title: "Idioteque" }),
      1_700_000_000,
    );
    const b = computeTrackIdentity(
      track({ artist: "  RADIOHEAD  ", title: "idioteque" }),
      1_700_000_000,
    );
    expect(a).toBe(b);
  });

  it("differs for a different artist or title", () => {
    const base = computeTrackIdentity(track(), 1_700_000_000);
    expect(computeTrackIdentity(track({ artist: "Someone Else" }), 1_700_000_000)).not.toBe(base);
    expect(computeTrackIdentity(track({ title: "Different Song" }), 1_700_000_000)).not.toBe(base);
  });

  it("treats near-simultaneous start times (within the bucket) as the same play", () => {
    const a = computeTrackIdentity(track(), 1_700_000_000);
    const b = computeTrackIdentity(track(), 1_700_000_002);
    expect(a).toBe(b);
  });

  it("treats start times far apart as different plays (a repeat listen)", () => {
    const a = computeTrackIdentity(track(), 1_700_000_000);
    const b = computeTrackIdentity(track(), 1_700_000_600);
    expect(a).not.toBe(b);
  });

  it("folds in album when present, but doesn't require it", () => {
    const withAlbum = computeTrackIdentity(track({ album: "Kid A" }), 1_700_000_000);
    const withoutAlbum = computeTrackIdentity(track(), 1_700_000_000);
    const withDifferentAlbum = computeTrackIdentity(track({ album: "Amnesiac" }), 1_700_000_000);
    expect(withAlbum).not.toBe(withoutAlbum);
    expect(withAlbum).not.toBe(withDifferentAlbum);
  });
});

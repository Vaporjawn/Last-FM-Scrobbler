import { describe, expect, it } from "vitest";
import { mapPayloadToTrackInfo } from "../../src/smtc/map-payload-to-track-info.js";

describe("mapPayloadToTrackInfo", () => {
  it("maps a full payload to TrackInfo", () => {
    const track = mapPayloadToTrackInfo({
      title: "Windowlicker",
      artist: "Aphex Twin",
      album: "Windowlicker EP",
      albumArtist: "Aphex Twin",
      durationSec: 320,
      sourceAppUserModelId: "Spotify.exe",
    });

    expect(track).toEqual({
      title: "Windowlicker",
      artist: "Aphex Twin",
      album: "Windowlicker EP",
      albumArtist: "Aphex Twin",
      durationSec: 320,
      sourceApp: "Spotify.exe",
      isStream: false,
    });
  });

  it("returns null when title is missing (mandatory)", () => {
    expect(mapPayloadToTrackInfo({ artist: "Artist", sourceAppUserModelId: "App.exe" })).toBeNull();
  });

  it("returns null when title is an empty string", () => {
    expect(mapPayloadToTrackInfo({ title: "", sourceAppUserModelId: "App.exe" })).toBeNull();
  });

  it("returns null when sourceAppUserModelId is missing (mandatory)", () => {
    expect(mapPayloadToTrackInfo({ title: "Song" })).toBeNull();
  });

  it("falls back to an empty string artist when artist is missing", () => {
    const track = mapPayloadToTrackInfo({ title: "Song", sourceAppUserModelId: "App.exe" });

    expect(track?.artist).toBe("");
  });

  it("omits album/albumArtist when not present", () => {
    const track = mapPayloadToTrackInfo({ title: "Song", sourceAppUserModelId: "App.exe" });

    expect(track?.album).toBeUndefined();
    expect(track?.albumArtist).toBeUndefined();
  });

  it("omits durationSec and marks isStream when durationSec is missing", () => {
    const track = mapPayloadToTrackInfo({ title: "Live Radio", sourceAppUserModelId: "App.exe" });

    expect(track?.durationSec).toBeUndefined();
    expect(track?.isStream).toBe(true);
  });

  it("omits durationSec and marks isStream when durationSec is zero or negative", () => {
    const track = mapPayloadToTrackInfo({
      title: "Live Radio",
      sourceAppUserModelId: "App.exe",
      durationSec: 0,
    });

    expect(track?.durationSec).toBeUndefined();
    expect(track?.isStream).toBe(true);
  });

  it("marks isStream false when a positive durationSec is present", () => {
    const track = mapPayloadToTrackInfo({
      title: "Song",
      sourceAppUserModelId: "App.exe",
      durationSec: 200,
    });

    expect(track?.isStream).toBe(false);
  });
});

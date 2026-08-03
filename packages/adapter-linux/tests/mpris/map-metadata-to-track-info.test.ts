import { Variant } from "dbus-next";
import { describe, expect, it } from "vitest";
import { mapMetadataToTrackInfo } from "../../src/mpris/map-metadata-to-track-info.js";

/** Real MPRIS players wrap every dict entry's value in a Variant; build fixtures that way. */
function metadata(fields: Record<string, unknown>): Record<string, unknown> {
  return fields;
}

describe("mapMetadataToTrackInfo", () => {
  it("maps a full metadata dict (Variant-wrapped values) to TrackInfo", () => {
    const track = mapMetadataToTrackInfo(
      metadata({
        "xesam:title": new Variant("s", "Windowlicker"),
        "xesam:artist": new Variant("as", ["Aphex Twin"]),
        "xesam:album": new Variant("s", "Windowlicker EP"),
        "xesam:albumArtist": new Variant("as", ["Aphex Twin"]),
        "mpris:length": new Variant("x", 320_000_000n),
      }),
      "vlc",
    );

    expect(track).toEqual({
      title: "Windowlicker",
      artist: "Aphex Twin",
      album: "Windowlicker EP",
      albumArtist: "Aphex Twin",
      durationSec: 320,
      sourceApp: "vlc",
      isStream: false,
    });
  });

  it("returns null when xesam:title is missing (mandatory field)", () => {
    expect(
      mapMetadataToTrackInfo(metadata({ "xesam:artist": new Variant("as", ["Artist"]) }), "vlc"),
    ).toBeNull();
  });

  it("returns null when xesam:title is an empty string", () => {
    expect(
      mapMetadataToTrackInfo(metadata({ "xesam:title": new Variant("s", "") }), "vlc"),
    ).toBeNull();
  });

  it("joins a multi-value xesam:artist array with a comma", () => {
    const track = mapMetadataToTrackInfo(
      metadata({
        "xesam:title": new Variant("s", "Collab Track"),
        "xesam:artist": new Variant("as", ["Artist One", "Artist Two"]),
      }),
      "vlc",
    );

    expect(track?.artist).toBe("Artist One, Artist Two");
  });

  it("falls back to an empty string artist when xesam:artist is absent", () => {
    const track = mapMetadataToTrackInfo(
      metadata({ "xesam:title": new Variant("s", "Solo") }),
      "vlc",
    );

    expect(track?.artist).toBe("");
  });

  it("tolerates a nonconformant player sending xesam:artist as a plain string", () => {
    const track = mapMetadataToTrackInfo(
      metadata({
        "xesam:title": new Variant("s", "Nonconformant"),
        "xesam:artist": new Variant("s", "Just A String"),
      }),
      "vlc",
    );

    expect(track?.artist).toBe("Just A String");
  });

  it("omits album/albumArtist when not present", () => {
    const track = mapMetadataToTrackInfo(
      metadata({ "xesam:title": new Variant("s", "Song") }),
      "vlc",
    );

    expect(track?.album).toBeUndefined();
    expect(track?.albumArtist).toBeUndefined();
  });

  it("omits durationSec when mpris:length is absent, without inferring isStream from it", () => {
    // Regression test: MPRIS has no dedicated "this is a live stream" field, unlike
    // macOS's MediaRemote — deriving isStream from "no mpris:length reported" used to
    // misclassify any ordinary track from a non-conformant player (common; many
    // minimal MPRIS clients don't populate it) as a stream. Duration-unknown and
    // is-a-stream are two distinct concepts.
    const track = mapMetadataToTrackInfo(
      metadata({ "xesam:title": new Variant("s", "Some Song") }),
      "vlc",
    );

    expect(track?.durationSec).toBeUndefined();
    expect(track?.isStream).toBe(false);
  });

  it("omits durationSec when mpris:length is zero, without inferring isStream from it", () => {
    const track = mapMetadataToTrackInfo(
      metadata({
        "xesam:title": new Variant("s", "Some Song"),
        "mpris:length": new Variant("x", 0n),
      }),
      "vlc",
    );

    expect(track?.durationSec).toBeUndefined();
    expect(track?.isStream).toBe(false);
  });

  it("tolerates mpris:length as a plain number instead of bigint", () => {
    const track = mapMetadataToTrackInfo(
      metadata({
        "xesam:title": new Variant("s", "Song"),
        "mpris:length": new Variant("x", 200_000_000),
      }),
      "vlc",
    );

    expect(track?.durationSec).toBe(200);
    expect(track?.isStream).toBe(false);
  });

  it("sets sourceApp from the provided argument, not from metadata", () => {
    const track = mapMetadataToTrackInfo(
      metadata({ "xesam:title": new Variant("s", "Song") }),
      "spotify",
    );

    expect(track?.sourceApp).toBe("spotify");
  });
});
